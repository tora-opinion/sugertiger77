const STRIPE_API_VERSION = "2026-02-25.clover";

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
    },
  });
}

function stripeHeaders(env) {
  return {
    authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
    "content-type": "application/x-www-form-urlencoded",
    "stripe-version": env.STRIPE_API_VERSION || STRIPE_API_VERSION,
  };
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

async function stripePost(path, env, body) {
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: "POST",
    headers: stripeHeaders(env),
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

async function finalizePaymentMethod(request, env) {
  if (!env.STRIPE_SECRET_KEY) {
    return jsonResponse(
      { error: "STRIPE_SECRET_KEY is not configured." },
      500,
    );
  }

  const payload = await readJson(request);
  if (typeof payload.session_id !== "string" || !payload.session_id) {
    return jsonResponse({ error: "session_id is required." }, 400);
  }

  const session = await stripeGet(`checkout/sessions/${payload.session_id}`, env);
  if (session.mode !== "setup" || !session.customer || !session.setup_intent) {
    return jsonResponse(
      { error: "The session is not a completed setup Checkout Session." },
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

export async function onRequestPost({ request, env }) {
  try {
    return await finalizePaymentMethod(request, env);
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }

    return jsonResponse(
      { error: "Failed to finalize Stripe payment method." },
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