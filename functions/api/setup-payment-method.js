const STRIPE_API_VERSION = "2026-02-25.clover";

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
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

async function stripeRequest(path, env, body, idempotencyKey) {
  const headers = {
    authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
    "content-type": "application/x-www-form-urlencoded",
    "stripe-version": env.STRIPE_API_VERSION || STRIPE_API_VERSION,
  };

  if (idempotencyKey) {
    headers["idempotency-key"] = idempotencyKey;
  }

  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: "POST",
    headers,
    body,
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Response(
      JSON.stringify({
        error: "Stripe request failed.",
        stripe_error: data.error?.message || "Unknown Stripe error.",
      }),
      {
        status: response.status,
        headers: {
          "content-type": "application/json; charset=utf-8",
        },
      },
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

  const customer = await stripeRequest(
    "customers",
    env,
    params,
    request.headers.get("Idempotency-Key")
      ? `${request.headers.get("Idempotency-Key")}:customer`
      : undefined,
  );

  return customer.id;
}

async function createSetupSession(request, env) {
  if (!env.STRIPE_SECRET_KEY) {
    return jsonResponse(
      { error: "STRIPE_SECRET_KEY is not configured." },
      500,
    );
  }

  const payload = await readJson(request);
  const customerId = await getOrCreateCustomer(request, env, payload);
  const baseUrl = getBaseUrl(request, env);
  const params = new URLSearchParams();

  params.set("mode", "setup");
  params.set("currency", "jpy");
  params.set("customer", customerId);
  params.set("success_url", `${baseUrl}/?payment_method=success&session_id={CHECKOUT_SESSION_ID}`);
  params.set("cancel_url", `${baseUrl}/?payment_method=cancel`);
  params.set("metadata[purpose]", "api_request_payment_method");

  const session = await stripeRequest(
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

export async function onRequestPost({ request, env }) {
  try {
    return await createSetupSession(request, env);
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }

    return jsonResponse(
      { error: "Failed to create Stripe setup session." },
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
