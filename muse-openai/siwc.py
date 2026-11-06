#!/usr/bin/env python3
"""Sign in with ChatGPT and use the OpenAI Responses API."""
import argparse
import base64
import datetime as dt
import hashlib
import hmac
import json
import os
from pathlib import Path
import secrets
import shutil
import socket
import ssl
import subprocess
import sys
import tempfile
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

BASE = Path.home() / ".config" / "muse-openai"
HOST_FILE = BASE / "host_id.txt"
CREDS_FILE = BASE / "credentials.json"
LOCK_FILE = BASE / "refresh.lock"
AUTH = "https://auth.openai.com"
API = "https://api.openai.com/v1"
REDIRECT = "http://127.0.0.1:1455/auth/callback"
RESOURCE = "https://api.openai.com/v1"
SCOPE = "openid profile email offline_access resource.invoke chatgpt.tokens.use.direct"
UA = "muse-openai/0.1"
JWT_RE = __import__("re").compile(r"eyJ[\w-]+\.[\w-]+\.[\w-]*")


def redact(value, known=()):
    if not isinstance(value, str):
        value = str(value)
    value = JWT_RE.sub("[REDACTED]", value)
    for secret in known:
        if secret:
            value = value.replace(str(secret), "[REDACTED]")
    return value


def say_error(message, known=()):
    print(redact(message, known), file=sys.stderr)


def b64u(data):
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def b64ud(text):
    return base64.urlsafe_b64decode(text + "=" * (-len(text) % 4))


def pkce_challenge(verifier):
    return b64u(hashlib.sha256(verifier.encode("ascii")).digest())


def secure_path(path):
    if os.name == "nt":
        user = os.environ.get("USERDOMAIN", "") + "\\" + os.environ.get("USERNAME", "")
        if not os.environ.get("USERNAME"):
            user = subprocess.check_output(["whoami"], text=True, stderr=subprocess.DEVNULL).strip()
        rc = subprocess.run(["icacls", str(path), "/inheritance:r", "/grant:r", user + ":F",
                             "/remove:g", "*S-1-5-32-544", "*S-1-5-18"],
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=False).returncode
        if rc != 0:
            raise RuntimeError("Could not apply owner-only permissions to " + str(path))
    else:
        os.chmod(path, 0o700 if Path(path).is_dir() else 0o600)


def ensure_dir():
    BASE.mkdir(parents=True, exist_ok=True)
    secure_path(BASE)


def read_creds():
    try:
        data = json.loads(CREDS_FILE.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {}
    except (OSError, ValueError):
        return {}


def atomic_credentials(data):
    ensure_dir()
    fd, name = tempfile.mkstemp(prefix=".credentials-", suffix=".tmp", dir=str(BASE))
    try:
        secure_path(name)
        with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
            f.write("\n")
            f.flush()
            os.fsync(f.fileno())
        secure_path(name)
        os.replace(name, CREDS_FILE)
        secure_path(CREDS_FILE)
    finally:
        try:
            os.unlink(name)
        except OSError:
            pass


def get_host_id(create=False):
    if HOST_FILE.exists():
        return HOST_FILE.read_text(encoding="utf-8").strip()
    if not create:
        return None
    ensure_dir()
    value = "urn:uuid:" + str(uuid.uuid4())
    fd = os.open(str(HOST_FILE), os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        f.write(value + "\n")
    secure_path(HOST_FILE)
    return value


def http_request(url, data=None, headers=None, timeout=30, known=()):
    req = urllib.request.Request(url, data=data, headers=headers or {}, method="POST" if data is not None else "GET")
    try:
        with urllib.request.urlopen(req, timeout=timeout, context=ssl.create_default_context()) as resp:
            return resp.status, resp.read()
    except urllib.error.HTTPError as exc:
        body = exc.read()
        raise RuntimeError("HTTP " + str(exc.code) + ": " + redact(body.decode("utf-8", "replace"), known)) from None
    except (urllib.error.URLError, TimeoutError, OSError) as exc:
        raise RuntimeError("Network request failed: " + redact(str(exc), known)) from None


def form_post(url, values, known=()):
    body = urllib.parse.urlencode(values).encode("ascii")
    _, raw = http_request(url, body, {"Content-Type": "application/x-www-form-urlencoded", "User-Agent": UA}, known=known)
    try:
        return json.loads(raw.decode("utf-8"))
    except (ValueError, UnicodeError):
        raise RuntimeError("Invalid token response") from None


def verify_rs256(token, jwks, expected_client, expected_nonce, saved_subject=None):
    try:
        head, payload, sig = token.split(".")
        header = json.loads(b64ud(head))
        claims = json.loads(b64ud(payload))
        if header.get("alg") != "RS256":
            raise ValueError("unsupported JWT algorithm")
        key = next(k for k in jwks.get("keys", []) if k.get("kid") == header.get("kid") and k.get("kty") == "RSA")
        n, e = int.from_bytes(b64ud(key["n"]), "big"), int.from_bytes(b64ud(key["e"]), "big")
        signature = b64ud(sig)
        size = (n.bit_length() + 7) // 8
        s = int.from_bytes(signature, "big")
        if len(signature) != size or s >= n:
            raise ValueError("invalid RSA signature size")
        em = pow(s, e, n).to_bytes(size, "big")
        digest_info = bytes.fromhex("3031300d060960864801650304020105000420") + hashlib.sha256((head + "." + payload).encode("ascii")).digest()
        pad_len = size - len(digest_info) - 3
        if pad_len < 8:
            raise ValueError("invalid RSA padding")
        expected = b"\x00\x01" + b"\xff" * pad_len + b"\x00" + digest_info
        if not hmac.compare_digest(em, expected):
            raise ValueError("invalid JWT signature")
        aud = claims.get("aud")
        if claims.get("iss") != AUTH or not (aud == expected_client or isinstance(aud, list) and expected_client in aud):
            raise ValueError("invalid JWT issuer or audience")
        if not isinstance(claims.get("exp"), (int, float)) or claims["exp"] <= time.time() - 60:
            raise ValueError("expired JWT")
        if claims.get("nonce") != expected_nonce:
            raise ValueError("invalid JWT nonce")
        if saved_subject is not None and claims.get("sub") != saved_subject:
            raise ValueError("signed-in account does not match the saved account")
        return claims
    except Exception as exc:
        if isinstance(exc, ValueError) and str(exc).startswith(("unsupported", "invalid", "expired", "signed-in")):
            raise
        raise ValueError("ID token verification failed") from None


def login():
    ensure_dir()
    creds = read_creds()
    host_id = get_host_id(create=True)
    returning = str(creds.get("client_id", "")).startswith("oaiapp_")
    client_id = creds["client_id"] if returning else "dynamic_agent_client"
    verifier = secrets.token_urlsafe(64)
    state, nonce = secrets.token_urlsafe(32), secrets.token_urlsafe(32)
    params = {"client_id": client_id, "ext_agent_host_id": host_id, "response_type": "code",
              "redirect_uri": REDIRECT, "scope": SCOPE, "resource": RESOURCE, "state": state,
              "nonce": nonce, "code_challenge": pkce_challenge(verifier), "code_challenge_method": "S256"}
    if not returning:
        params["agent_name_hint"] = "Muse"
    else:
        if creds.get("id_token"): params["id_token_hint"] = creds["id_token"]
        if creds.get("email"): params["login_hint"] = creds["email"]
    url = AUTH + "/api/accounts/authorize?" + urllib.parse.urlencode(params)
    shown_url = urllib.parse.urlencode({k: ("[REDACTED]" if k == "id_token_hint" else v) for k, v in params.items()})
    result, ready = {}, threading.Event()
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *_): pass
        def do_GET(self):
            parsed = urllib.parse.urlsplit(self.path)
            if parsed.path != "/auth/callback":
                self.send_error(404); return
            q = urllib.parse.parse_qs(parsed.query, keep_blank_values=True)
            get = lambda k: q.get(k, [""])[0]
            if not hmac.compare_digest(get("state"), state):
                result["error"] = "State verification failed"
            elif get("error"):
                result["error"] = "Authorization failed: " + get("error")
            else:
                result.update(code=get("code"), client_id=get("client_id"), scope=get("scope"))
                if not result["code"]: result["error"] = "Authorization callback did not include a code"
            body = ("Sign-in complete, you can close this tab." if not result.get("error") else "Sign-in failed. You can close this tab.").encode()
            self.send_response(200); self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body))); self.end_headers(); self.wfile.write(body)
            ready.set()
    try:
        server = ThreadingHTTPServer(("127.0.0.1", 1455), Handler)
    except OSError:
        raise RuntimeError("Could not bind the sign-in callback on 127.0.0.1:1455") from None
    server.timeout = 0.5
    print("Authorization URL: " + redact(AUTH + "/api/accounts/authorize?" + shown_url, [creds.get("id_token", "")]))
    print("Waiting for you to sign in in the browser...")
    webbrowser.open(url)
    deadline = time.monotonic() + 600
    try:
        while not ready.is_set() and time.monotonic() < deadline:
            server.handle_request()
        if not ready.is_set(): raise RuntimeError("Sign-in timed out")
        if result.get("error"): raise RuntimeError(result["error"])
        issued = creds.get("client_id") if returning else result.get("client_id", "")
        if not returning and not issued.startswith("oaiapp_"):
            raise RuntimeError("registration incomplete")
        if returning and result.get("client_id") and result["client_id"] != issued:
            raise RuntimeError("Callback client_id did not match the saved client")
        if result.get("scope") and "chatgpt.tokens.use.direct" not in result["scope"].split():
            print("Warning: callback scope does not include chatgpt.tokens.use.direct", file=sys.stderr)
        known = [result.get("code", ""), verifier, creds.get("id_token", "")]
        token_data = form_post(AUTH + "/api/accounts/oauth/token", {"grant_type": "authorization_code", "client_id": issued,
            "code": result["code"], "code_verifier": verifier, "redirect_uri": REDIRECT, "resource": RESOURCE}, known)
        id_token = token_data.get("id_token")
        if not id_token: raise RuntimeError("Token response did not include an ID token")
        _, config_raw = http_request(AUTH + "/.well-known/openid-configuration", known=known)
        config = json.loads(config_raw)
        jwks_uri = config.get("jwks_uri", AUTH + "/.well-known/jwks.json")
        _, jwks_raw = http_request(jwks_uri, known=known)
        claims = verify_rs256(id_token, json.loads(jwks_raw), issued, nonce, creds.get("subject") if returning else None)
        now = time.time()
        saved = {"email": claims.get("email"), "issuer": claims.get("iss"), "subject": claims.get("sub"),
                 "client_id": issued, "ext_agent_host_id": host_id, "id_token": id_token,
                 "access_token": token_data.get("access_token"), "refresh_token": token_data.get("refresh_token"),
                 "token_type": token_data.get("token_type"), "expires_in": token_data.get("expires_in"),
                 "expires_at": now + float(token_data.get("expires_in", 0)),
                 "scopes": (token_data.get("scope") or result.get("scope") or "").split(),
                 "saved_at": dt.datetime.now(dt.timezone.utc).isoformat()}
        if not saved["access_token"] or not saved["refresh_token"]: raise RuntimeError("Token response is missing required tokens")
        atomic_credentials(saved)
        print("Sign-in complete.")
    finally:
        server.server_close()


FRIENDLY = {
 "subscription_sharing_user_not_eligible": "This ChatGPT account is not eligible for plan sharing.",
 "subscription_sharing_usage_limit_exceeded": "Plan usage limit reached. See https://chatgpt.com/settings/usage",
 "subscription_sharing_usage_unavailable": "Plan usage is currently unavailable.",
 "subscription_sharing_unsupported_capability": "This capability is not supported (parameter: {param}).",
 "subscription_sharing_route_not_supported": "This API route is not supported for plan usage.",
 "subscription_sharing_invalid_user": "The signed-in user is invalid. Run login again.",
 "chatpass_v2_scope_not_authorized": "The required plan usage scope is not authorized. Run login again.",
 "chatpass_v2_invalid_authorization_context": "Authorization context is invalid. Run login again.",
}
REFRESH_ERRORS = {"invalid_grant", "invalid_refresh_token", "token_expired", "refresh_token_expired", "refresh_token_invalidated", "refresh_token_reused"}


def response_error(raw, known=()):
    try: obj = json.loads(raw.decode("utf-8", "replace"))
    except Exception: obj = {}
    err = obj.get("error", obj) if isinstance(obj, dict) else {}
    if isinstance(err, str): code, message, param = err, err, ""
    elif isinstance(err, dict): code, message, param = err.get("code", ""), err.get("message", ""), err.get("param", "")
    else: code, message, param = "", "", ""
    friendly = FRIENDLY.get(code)
    if friendly: message = friendly.format(param=redact(param, known) or "unknown")
    elif obj.get("detail") if isinstance(obj, dict) else False: message = obj["detail"]
    return redact(message or ("Request failed (" + str(code) + ")"), known), code


def refresh_tokens():
    ensure_dir()
    deadline = time.monotonic() + 30
    fd = None
    while fd is None:
        try:
            fd = os.open(str(LOCK_FILE), os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
        except FileExistsError:
            try:
                if time.time() - LOCK_FILE.stat().st_mtime > 120: LOCK_FILE.unlink(); continue
            except OSError: pass
            if time.monotonic() >= deadline: raise RuntimeError("Timed out waiting for token refresh") from None
            time.sleep(0.2)
    try:
        os.close(fd)
        creds = read_creds()
        if float(creds.get("expires_at", 0)) - time.time() >= 60 and creds.get("access_token"):
            return creds
        refresh = creds.get("refresh_token")
        if not refresh: raise RuntimeError("No refresh token. Run login again.")
        known = [creds.get(k, "") for k in ("access_token", "refresh_token", "id_token")]
        try:
            data = form_post(AUTH + "/api/accounts/oauth/token", {"grant_type": "refresh_token", "client_id": creds["client_id"],
                "refresh_token": refresh, "resource": RESOURCE}, known)
        except RuntimeError as exc:
            msg, code = response_error(str(exc).encode(), known)
            if any(c in str(exc) for c in REFRESH_ERRORS):
                creds.update(access_token=None, refresh_token=None, expires_at=0)
                atomic_credentials(creds)
                raise RuntimeError("Refresh token is no longer valid. Run login again.") from None
            raise RuntimeError(msg) from None
        now = time.time()
        creds.update(access_token=data.get("access_token"), refresh_token=data.get("refresh_token"),
                     expires_in=data.get("expires_in"), expires_at=now + float(data.get("expires_in", 0)),
                     scopes=(data.get("scope") or " ".join(creds.get("scopes", []))).split(),
                     saved_at=dt.datetime.now(dt.timezone.utc).isoformat())
        if data.get("id_token"): creds["id_token"] = data["id_token"]
        if not creds.get("access_token") or not creds.get("refresh_token"): raise RuntimeError("Refresh response is missing tokens")
        atomic_credentials(creds)
        return creds
    finally:
        try: LOCK_FILE.unlink()
        except OSError: pass


def api_request(path, method="GET", body=None, retry=True, stream=False):
    creds = refresh_tokens()
    known = [creds.get(k, "") for k in ("access_token", "refresh_token", "id_token")]
    rawbody = json.dumps(body).encode() if body is not None else None
    headers = {"Authorization": "Bearer " + creds["access_token"], "User-Agent": UA}
    if body is not None: headers["Content-Type"] = "application/json"
    if stream: headers["Accept"] = "text/event-stream"
    req = urllib.request.Request(API + path, data=rawbody, headers=headers, method=method)
    try:
        return urllib.request.urlopen(req, timeout=300 if stream else 30, context=ssl.create_default_context()), creds
    except urllib.error.HTTPError as exc:
        raw = exc.read()
        if exc.code == 401 and retry:
            creds["expires_at"] = 0
            atomic_credentials(creds)
            return api_request(path, method, body, False, stream)
        msg, _ = response_error(raw, known)
        raise RuntimeError(msg) from None
    except (urllib.error.URLError, TimeoutError, OSError) as exc:
        raise RuntimeError(redact(str(exc), known)) from None


def list_models(show=True):
    response, creds = api_request("/models")
    with response: obj = json.loads(response.read().decode("utf-8"))
    items = obj.get("models", obj.get("data", []))
    output = []
    for item in items:
        if "visibility" in item and item.get("visibility") != "list": continue
        ident = item.get("slug") or item.get("id")
        if ident: output.append((ident, item.get("display_name")))
    for ident, name in (output if show else []): print(ident + (("  " + name) if name else ""))
    return output


def ask(prompt, model, check_phrase=False):
    response, creds = api_request("/responses", "POST", {"model": model, "input": [{"role": "user", "content": [{"type": "input_text", "text": prompt}]}], "store": False, "stream": True}, stream=True)
    completed, full, event, data_lines = False, [], "", []
    def process(ev, payload):
        nonlocal completed
        if not payload or payload == "[DONE]": return
        try: obj = json.loads(payload)
        except ValueError: return
        typ = ev or obj.get("type", "")
        if typ == "response.output_text.delta":
            delta = obj.get("delta", "")
            if isinstance(delta, str): print(redact(delta, [creds.get(k, "") for k in ("access_token", "refresh_token", "id_token")]), end="", flush=True); full.append(delta)
        elif typ == "response.completed": completed = True
        elif typ in ("response.failed", "response.incomplete", "error"):
            msg, _ = response_error(json.dumps(obj).encode(), [creds.get(k, "") for k in ("access_token", "refresh_token", "id_token")])
            raise RuntimeError(msg)
    try:
        for rawline in response:
            line = rawline.decode("utf-8", "replace").rstrip("\r\n")
            if not line:
                process(event, "\n".join(data_lines)); event, data_lines = "", []; continue
            if line.startswith("event:"): event = line[6:].strip()
            elif line.startswith("data:"): data_lines.append(line[5:].lstrip())
        if data_lines: process(event, "\n".join(data_lines))
    finally: response.close()
    print()
    if not completed: raise RuntimeError("Response stream ended without response.completed")
    return "".join(full)


def status():
    c = read_creds()
    signed = bool(c.get("access_token") and c.get("refresh_token"))
    print("Signed in: " + ("yes" if signed else "no"))
    if signed:
        print("Email: " + redact(c.get("email") or "(not provided)", [c.get("access_token"), c.get("refresh_token"), c.get("id_token")]))
        scopes = c.get("scopes", [])
        print("Granted scopes: " + " ".join(scopes))
        print("Plan usage enabled: " + ("yes" if "chatgpt.tokens.use.direct" in scopes else "no"))
        remaining = float(c.get("expires_at", 0)) - time.time()
        print("Access token expiry: " + (str(max(0, int(remaining))) + " seconds remaining" if remaining > 0 else "expired"))
        print("Refresh token present: " + ("yes" if c.get("refresh_token") else "no"))
        cid = c.get("client_id", "")
        print("Issued client_id present: " + ("yes (oaiapp_…)" if cid.startswith("oaiapp_") else "no"))
    print("Host id file present: " + ("yes" if HOST_FILE.exists() else "no"))


def selftest():
    verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"
    assert pkce_challenge(verifier) == "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"
    # Deterministic Miller-Rabin and RSA key generation are deliberately local and dependency-free.
    def prime(bits):
        while True:
            candidate = secrets.randbits(bits) | (1 << (bits - 1)) | 1
            d, s = candidate - 1, 0
            while d % 2 == 0: d //= 2; s += 1
            if all(pow(a, d, candidate) not in (1, candidate - 1) and
                   not any(pow(a, d * (2 ** r), candidate) == candidate - 1 for r in range(1, s))
                   for a in (2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37)):
                continue
            return candidate
    def inv(a, m): return pow(a, -1, m)
    e = 65537
    p, q = prime(512), prime(512)
    while p == q or (p - 1) % e == 0 or (q - 1) % e == 0: q = prime(512)
    n, phi = p * q, (p - 1) * (q - 1)
    d = inv(e, phi)
    now = int(time.time())
    claims = {"iss": AUTH, "aud": "oaiapp_selftest", "exp": now + 300, "nonce": "nonce-selftest", "sub": "subject"}
    header = {"alg": "RS256", "kid": "selftest", "typ": "JWT"}
    h, pl = b64u(json.dumps(header, separators=(",", ":")).encode()), b64u(json.dumps(claims, separators=(",", ":")).encode())
    di = bytes.fromhex("3031300d060960864801650304020105000420") + hashlib.sha256((h + "." + pl).encode()).digest()
    k = (n.bit_length() + 7) // 8
    em = b"\x00\x01" + b"\xff" * (k - len(di) - 3) + b"\x00" + di
    sig = pow(int.from_bytes(em, "big"), d, n).to_bytes(k, "big")
    token = h + "." + pl + "." + b64u(sig)
    jwks = {"keys": [{"kid": "selftest", "kty": "RSA", "n": b64u(n.to_bytes(k, "big")), "e": b64u(e.to_bytes(3, "big"))}]}
    verify_rs256(token, jwks, "oaiapp_selftest", "nonce-selftest")
    bad_sig = bytearray(sig); bad_sig[-1] ^= 1
    try: verify_rs256(h + "." + pl + "." + b64u(bytes(bad_sig)), jwks, "oaiapp_selftest", "nonce-selftest")
    except ValueError: pass
    else: raise AssertionError("tampered signature accepted")
    bad_pl = b64u(json.dumps(dict(claims, sub="attacker"), separators=(",", ":")).encode())
    try: verify_rs256(h + "." + bad_pl + "." + b64u(sig), jwks, "oaiapp_selftest", "nonce-selftest")
    except ValueError: pass
    else: raise AssertionError("tampered JWT accepted")
    print("Self-test passed (PKCE and RS256 verifier).")


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    parser = argparse.ArgumentParser(description="Use your ChatGPT plan with the Responses API")
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("login")
    sub.add_parser("status")
    sub.add_parser("models")
    sub.add_parser("selftest", help=argparse.SUPPRESS)
    a = sub.add_parser("ask"); a.add_argument("prompt"); a.add_argument("--model")
    sub.add_parser("verify")
    args = parser.parse_args()
    try:
        if args.command == "login": login()
        elif args.command == "status": status()
        elif args.command == "selftest": selftest()
        elif args.command == "models": list_models()
        elif args.command == "ask":
            model = args.model
            if not model:
                models = list_models(show=False)
                if not models: raise RuntimeError("No models are available")
                model = models[0][0]
            ask(args.prompt, model)
        elif args.command == "verify":
            models = list_models()
            if not models: raise RuntimeError("No models are available")
            result = ask("Say exactly: Hello, world!", models[0][0])
            if "Hello, world!" not in result: raise RuntimeError("Verification response did not contain the expected text")
            print("PASS")
    except Exception as exc:
        say_error(str(exc))
        return 1
    return 0

if __name__ == "__main__":
    raise SystemExit(main())

