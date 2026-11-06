# muse-openai

A Python 3 standard-library CLI for Sign in with ChatGPT and the Responses API.

```powershell
python siwc.py login
python siwc.py status
python siwc.py models
python siwc.py ask "Summarize the latest paper on ..." --model MODEL
python siwc.py verify
```

Credentials are stored under `%USERPROFILE%\.config\muse-openai` (or `~/.config/muse-openai`): `credentials.json`, `host_id.txt`, and the refresh lock. The tool never prints token values. Run `python siwc.py selftest` for the offline PKCE and RS256 checks.
