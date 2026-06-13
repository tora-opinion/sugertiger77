const STRIPE_API_VERSION = "2026-02-25.clover";

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
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

function getBaseUrl(request, env) {
  if (env.SITE_URL) {
    return env.SITE_URL.replace(/\/$/, "");
  }

  const url = new URL(request.url);
  return url.origin;
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

async function getOrCreateCustomer(request, env, payload) {
  if (typeof payload.customer_id === "string" && payload.customer_id) {
    return payload.customer_id;
  }

  const params = new URLSearchParams();
  if (typeof payload.email === "string" && payload.email) {
    params.set("email", payload.email);
  }
  if (typeof payload.name === "string" && payload.name) {
    params.set("name", payload.name);
  }
  params.set("metadata[purpose]", "api_request_payment_method");

  const customer = await stripePost(
    "customers",
    env,
    params,
    request.headers.get("Idempotency-Key")
      ? `${request.headers.get("Idempotency-Key")}:customer`
      : undefined,
  );

  return customer.id;
}

async function createSetupSession(request, env, payload) {
  const customerId = await getOrCreateCustomer(request, env, payload);
  const baseUrl = getBaseUrl(request, env);
  const params = new URLSearchParams();

  params.set("mode", "setup");
  params.set("currency", "jpy");
  params.set("customer", customerId);
  params.set("success_url", `${baseUrl}/?payment_method=success&session_id={CHECKOUT_SESSION_ID}`);
  params.set("cancel_url", `${baseUrl}/?payment_method=cancel`);
  params.set("metadata[purpose]", "api_request_payment_method");

  const session = await stripePost(
    "checkout/sessions",
    env,
    params,
    request.headers.get("Idempotency-Key")
      ? `${request.headers.get("Idempotency-Key")}:setup-session`
      : undefined,
  );

  return jsonResponse(
    {
      setup_url: session.url,
      session_id: session.id,
      customer_id: customerId,
    },
    201,
  );
}

async function finalizeSetupSession(env, sessionId) {
  const session = await stripeGet(`checkout/sessions/${sessionId}`, env);
  if (session.mode !== "setup" || !session.customer || !session.setup_intent) {
    return jsonResponse(
      { error: "The session is not a setup Checkout Session." },
      400,
    );
  }

  const setupIntent = await stripeGet(`setup_intents/${session.setup_intent}`, env);
  if (setupIntent.status !== "succeeded" || !setupIntent.payment_method) {
    return jsonResponse(
      {
        error: "Payment method setup is not complete.",
        status: setupIntent.status,
      },
      400,
    );
  }

  const params = new URLSearchParams();
  params.set("invoice_settings[default_payment_method]", setupIntent.payment_method);

  await stripePost(`customers/${session.customer}`, env, params);

  return jsonResponse({
    customer_id: session.customer,
    payment_method_id: setupIntent.payment_method,
    ready_for_request_charge: true,
  });
}

async function handleSetupPaymentMethod(request, env) {
  if (!env.STRIPE_SECRET_KEY) {
    return jsonResponse(
      { error: "STRIPE_SECRET_KEY is not configured." },
      500,
    );
  }

  const payload = await readJson(request);
  if (typeof payload.session_id === "string" && payload.session_id) {
    return finalizeSetupSession(env, payload.session_id);
  }

  return createSetupSession(request, env, payload);
}

export async function onRequestPost({ request, env }) {
  try {
    return await handleSetupPaymentMethod(request, env);
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }

    return jsonResponse(
      { error: "Failed to process Stripe payment method setup." },
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