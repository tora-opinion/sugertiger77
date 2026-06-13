const STRIPE_API_VERSION = "2026-02-25.clover";
const DEFAULT_TO_EMAIL = "sugertiger77@gmail.com";
const DEFAULT_FROM_EMAIL = "SugerTiger77 <onboarding@resend.dev>";

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
    },
  });
}

function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes) {
  return [...new Uint8Array(bytes)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqualHex(a, b) {
  if (a.length !== b.length) {
    return false;
  }

  const left = hexToBytes(a);
  const right = hexToBytes(b);
  let diff = 0;
  for (let i = 0; i < left.length; i += 1) {
    diff |= left[i] ^ right[i];
  }

  return diff === 0;
}

function parseStripeSignature(signature) {
  const parts = Object.fromEntries(
    signature.split(",").map((part) => {
      const [key, value] = part.split("=");
      return [key, value];
    }),
  );

  return {
    timestamp: parts.t,
    signature: parts.v1,
  };
}

async function verifyStripeSignature(rawBody, signatureHeader, webhookSecret) {
  if (!signatureHeader || !webhookSecret) {
    return false;
  }

  const { timestamp, signature } = parseStripeSignature(signatureHeader);
  if (!timestamp || !signature) {
    return false;
  }

  const signedPayload = `${timestamp}.${rawBody}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(webhookSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(signedPayload),
  );

  return timingSafeEqualHex(bytesToHex(digest), signature);
}

function formatAmount(amount, currency) {
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount / (currency.toLowerCase() === "jpy" ? 1 : 100));
}

function buildPaymentEmail(paymentIntent) {
  const amount = formatAmount(paymentIntent.amount_received || paymentIntent.amount, paymentIntent.currency);
  const customer = paymentIntent.customer || "なし";
  const description = paymentIntent.description || "API request";

  return {
    subject: `支払い完了: ${amount}`,
    html: `
      <h1>支払いが完了しました</h1>
      <p><strong>金額:</strong> ${amount}</p>
      <p><strong>PaymentIntent:</strong> ${paymentIntent.id}</p>
      <p><strong>Customer:</strong> ${customer}</p>
      <p><strong>説明:</strong> ${description}</p>
      <p><strong>ステータス:</strong> ${paymentIntent.status}</p>
    `,
  };
}

async function sendEmail(env, event, paymentIntent) {
  if (!env.RESEND_API_KEY) {
    throw jsonResponse({ error: "RESEND_API_KEY is not configured." }, 500);
  }

  const email = buildPaymentEmail(paymentIntent);
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.RESEND_API_KEY}`,
      "content-type": "application/json",
      "idempotency-key": `stripe-payment-complete-${event.id}`,
    },
    body: JSON.stringify({
      from: env.RESEND_FROM_EMAIL || DEFAULT_FROM_EMAIL,
      to: [env.RESEND_TO_EMAIL || DEFAULT_TO_EMAIL],
      subject: email.subject,
      html: email.html,
    }),
  });
  const body = await response.json();

  if (!response.ok) {
    throw jsonResponse(
      {
        error: "Failed to send payment email.",
        resend_error: body.message || body.error || "Unknown Resend error.",
      },
      502,
    );
  }

  return body.id;
}

export async function onRequestPost({ request, env }) {
  if (!env.STRIPE_WEBHOOK_SECRET) {
    return jsonResponse({ error: "STRIPE_WEBHOOK_SECRET is not configured." }, 500);
  }

  const rawBody = await request.text();
  const verified = await verifyStripeSignature(
    rawBody,
    request.headers.get("stripe-signature"),
    env.STRIPE_WEBHOOK_SECRET,
  );

  if (!verified) {
    return jsonResponse({ error: "Invalid Stripe signature." }, 400);
  }

  const event = JSON.parse(rawBody);
  if (event.type !== "payment_intent.succeeded") {
    return jsonResponse({ received: true, ignored: true });
  }

  const paymentIntent = event.data.object;
  const emailId = await sendEmail(env, event, paymentIntent);

  return jsonResponse({ received: true, email_id: emailId });
}