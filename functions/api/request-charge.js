const STRIPE_API_VERSION = "2026-02-25.clover";
const PRICE_YEN = 100;

function jsonResponse(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...headers,
    },
  });
}

function getBaseUrl(request, env) {
  if (env.SITE_URL) {
    return env.SITE_URL.replace(/\/$/, "");
  }

  const url = new URL(request.url);
  return url.origin;
}

function buildCheckoutBody(baseUrl) {
  const params = new URLSearchParams();

  params.set("mode", "payment");
  params.set("success_url", `${baseUrl}/?payment=success&session_id={CHECKOUT_SESSION_ID}`);
  params.set("cancel_url", `${baseUrl}/?payment=cancel`);
  params.set("line_items[0][quantity]", "1");
  params.set("line_items[0][price_data][currency]", "jpy");
  params.set("line_items[0][price_data][unit_amount]", String(PRICE_YEN));
  params.set("line_items[0][price_data][product_data][name]", "API request");
  params.set("metadata[charge_type]", "api_request");

  return params;
}

async function createCheckoutSession(request, env) {
  if (!env.STRIPE_SECRET_KEY) {
    return jsonResponse(
      { error: "STRIPE_SECRET_KEY is not configured." },
      500,
    );
  }

  const idempotencyKey =
    request.headers.get("Idempotency-Key") || crypto.randomUUID();
  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      "content-type": "application/x-www-form-urlencoded",
      "stripe-version": env.STRIPE_API_VERSION || STRIPE_API_VERSION,
      "idempotency-key": idempotencyKey,
    },
    body: buildCheckoutBody(getBaseUrl(request, env)),
  });

  const stripeBody = await response.json();

  if (!response.ok) {
    return jsonResponse(
      {
        error: "Failed to create Stripe Checkout Session.",
        stripe_error: stripeBody.error?.message || "Unknown Stripe error.",
      },
      response.status,
    );
  }

  return jsonResponse(
    {
      checkout_url: stripeBody.url,
      session_id: stripeBody.id,
      amount: PRICE_YEN,
      currency: "jpy",
    },
    201,
  );
}

export async function onRequestPost({ request, env }) {
  return createCheckoutSession(request, env);
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      allow: "POST, OPTIONS",
    },
  });
}
