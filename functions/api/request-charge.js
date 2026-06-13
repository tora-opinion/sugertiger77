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

function stripeHeaders(env, idempotencyKey) {
  const headers = {
    authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
    "content-type": "application/x-www-form-urlencoded",
    "stripe-version": env.STRIPE_API_VERSION || STRIPE_API_VERSION,
  };

  if (idempotencyKey) {
    headers["idempotency-key"] = idempotencyKey;
  }

  return headers;
}

async function readJson(request) {
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return {};
  }

  try {
    return await request.json();
  } catch {
    return {};
  }
}

function getBaseUrl(request, env) {
  if (env.SITE_URL) {
    return env.SITE_URL.replace(/\/$/, "");
  }

  const url = new URL(request.url);
  return url.origin;
}

async function stripeGet(path, env) {
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    headers: stripeHeaders(env),
  });
  const data = await response.json();

  if (!response.ok) {
    throw jsonResponse(
      {
        error: "Stripe request failed.",
        stripe_error: data.error?.message || "Unknown Stripe error.",
      },
      response.status,
    );
  }

  return data;
}

async function stripePost(path, env, body, idempotencyKey) {
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: "POST",
    headers: stripeHeaders(env, idempotencyKey),
    body,
  });
  const data = await response.json();

  if (!response.ok) {
    throw jsonResponse(
      {
        error: "Stripe request failed.",
        stripe_error: data.error?.message || "Unknown Stripe error.",
      },
      response.status,
    );
  }

  return data;
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
  const session = await stripePost(
    "checkout/sessions",
    env,
    buildCheckoutBody(getBaseUrl(request, env)),
    request.headers.get("Idempotency-Key") || crypto.randomUUID(),
  );

  return jsonResponse(
    {
      checkout_url: session.url,
      session_id: session.id,
      amount: PRICE_YEN,
      currency: "jpy",
    },
    201,
  );
}

async function getDefaultPaymentMethod(env, customerId, suppliedPaymentMethodId) {
  if (typeof suppliedPaymentMethodId === "string" && suppliedPaymentMethodId) {
    return suppliedPaymentMethodId;
  }

  const customer = await stripeGet(`customers/${customerId}`, env);
  return customer.invoice_settings?.default_payment_method || null;
}

async function chargeSavedPaymentMethod(request, env, payload) {
  if (typeof payload.customer_id !== "string" || !payload.customer_id) {
    return createCheckoutSession(request, env);
  }

  const paymentMethodId = await getDefaultPaymentMethod(
    env,
    payload.customer_id,
    payload.payment_method_id,
  );

  if (!paymentMethodId) {
    return jsonResponse(
      {
        error: "No saved default payment method for this customer.",
        next_step: "Complete /api/setup-payment-method, then call /api/finalize-payment-method with the setup session_id.",
      },
      400,
    );
  }

  const params = new URLSearchParams();
  params.set("amount", String(PRICE_YEN));
  params.set("currency", "jpy");
  params.set("customer", payload.customer_id);
  params.set("payment_method", paymentMethodId);
  params.set("confirm", "true");
  params.set("off_session", "true");
  params.set("description", "API request");
  params.set("metadata[charge_type]", "api_request");

  const paymentIntent = await stripePost(
    "payment_intents",
    env,
    params,
    request.headers.get("Idempotency-Key") || crypto.randomUUID(),
  );

  return jsonResponse(
    {
      payment_intent_id: paymentIntent.id,
      status: paymentIntent.status,
      customer_id: payload.customer_id,
      amount: PRICE_YEN,
      currency: "jpy",
      charged: paymentIntent.status === "succeeded",
    },
    201,
  );
}

export async function onRequestPost({ request, env }) {
  if (!env.STRIPE_SECRET_KEY) {
    return jsonResponse(
      { error: "STRIPE_SECRET_KEY is not configured." },
      500,
    );
  }

  try {
    const payload = await readJson(request);
    return await chargeSavedPaymentMethod(request, env, payload);
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }

    return jsonResponse(
      { error: "Failed to create Stripe payment." },
      500,
    );
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      allow: "POST, OPTIONS",
    },
  });
}