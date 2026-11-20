import { env } from "cloudflare:workers";
import { createAuthClient } from "../../../lib/autopay/auth";
import { ApiError, body, serve } from "../../../lib/autopay/service.mjs";

export const dynamic = "force-dynamic";

const sessionActions = new Set(["request-code", "verify-code", "sign-out"]);

function json(data: object, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

async function handleSession(request: Request, action: string, url: URL) {
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
  if (request.headers.get("origin") !== url.origin || request.headers.get("X-AutoPay-Request") !== "1") {
    return json({ error: "Request origin could not be verified." }, 403);
  }

  const client = await createAuthClient(request);
  if (!client) return json({ error: "Email sign-in has not been configured." }, 503);
  if (action === "sign-out") {
    const { error } = await client.auth.signOut({ scope: "local" });
    return error ? json({ error: "Could not log out. Please retry." }, 503) : json({ ok: true });
  }

  const input = await body(request);
  const email = typeof input?.email === "string" ? input.email.trim().toLowerCase() : "";
  if (email.length > 200 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: "Enter a valid email address." }, 400);
  }

  if (action === "request-code") {
    const { error } = await client.auth.signInWithOtp({ email });
    if (error) {
      if (error.status === 429) return json({ error: "Wait before requesting another code." }, 429);
      return json({ error: "Could not send a code. Please try again." }, 503);
    }
    return json({ ok: true });
  }

  const token = typeof input?.code === "string" ? input.code.trim() : "";
  if (!/^\d{6,10}$/.test(token)) return json({ error: "Enter the code from your email." }, 400);

  const { data, error } = await client.auth.verifyOtp({ email, token, type: "email" });
  if (error?.status === 429) return json({ error: "Too many attempts. Please wait and retry." }, 429);
  if (error && (error.status === 0 || (error.status ?? 0) >= 500)) {
    return json({ error: "Email sign-in is temporarily unavailable." }, 503);
  }
  if (!data.session || !data.user?.email_confirmed_at) {
    return json({ error: "That code is invalid or expired. Request a new code and try again." }, 401);
  }
  return json({ ok: true });
}

async function handle(request: Request) {
  try {
    const url = new URL(request.url);
    const action = url.pathname.match(/^\/api\/auth\/([^/]+)\/?$/)?.[1];
    if (action && sessionActions.has(action)) return await handleSession(request, action, url);

    const client = await createAuthClient(request);
    const result = await client?.auth.getUser();
    const error = result?.error;
    if (error && (error.status === 0 || (error.status ?? 0) >= 500)) {
      return json({ error: "Email sign-in is temporarily unavailable." }, 503);
    }

    const account = result?.data.user;
    const user = account?.email && account.email_confirmed_at
      ? { userId: account.id, email: account.email.toLowerCase(), displayName: account.email }
      : null;

    return await serve(request, { db: env.DB, bucket: env.BUCKET, user, env });
  } catch (error) {
    if (error instanceof ApiError) return json({ error: error.message }, error.status);
    return json({ error: "The account service is temporarily unavailable." }, 503);
  }
}

export const GET = handle;
export const POST = handle;
