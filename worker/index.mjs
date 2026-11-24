/**
 * Cloudflare Worker entry point for public configuration, authenticated API requests, static assets, and cron.
 * Security headers are applied to every response returned through handle().
 */
import { runScheduledReports } from "../lib/autopay/reports.mjs";
import { DatabaseFiles } from "./database-files.mjs";
import { serve } from "../lib/autopay/service.mjs";
import { authConfig, authenticatedUser, adoptMigratedIdentity, AuthUnavailable } from "./auth.mjs";
// Allow connections to this origin and the configured auth origin; deny embedding and privileged browser features.
function secure(response, env) {
  const headers = new Headers(response.headers);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  const connect = authConfig(env)?.url || "";
  headers.set(
    "Content-Security-Policy",
    `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self' ${connect}; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'`,
  );
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
export async function handle(request, env) {
  const url = new URL(request.url);
  let response;
  if (url.pathname === "/api/health" && request.method === "GET")
    response = Response.json(
      {
        ok: true,
        authenticationConfigured: !!authConfig(env),
        chatMode: env.AUTOPAY_CHAT_MODE === "openai" ? "openai" : "testing",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  // Public boot configuration exposes only values that are safe for the browser SDK.
  else if (url.pathname === "/api/public-config" && request.method === "GET") {
    const c = authConfig(env);
    response = Response.json(
      c
        ? { configured: true, supabaseUrl: c.url, supabasePublishableKey: c.key }
        : {
            configured: false,
            message:
              "Email login needs the Supabase project URL and public publishable key configured on the server.",
          },
      { headers: { "Cache-Control": "no-store" } },
    );
  } else if (url.pathname.startsWith("/api/")) {
    if (!env.DB)
      response = Response.json({ error: "Workspace storage is not configured." }, { status: 503 });
    else
      try {
        const user = await authenticatedUser(request, env);
        if (user) await adoptMigratedIdentity(env.DB, user);
        response = await serve(request, {
          db: env.DB,
          bucket: env.BUCKET || new DatabaseFiles(env.DB),
          user,
          env,
        });
      } catch (error) {
        response = Response.json(
          {
            error:
              error instanceof AuthUnavailable
                ? error.message
                : "The workspace is temporarily unavailable.",
          },
          { status: 503, headers: { "Cache-Control": "no-store" } },
        );
      }
  } else response = await env.ASSETS.fetch(request);
  return secure(response, env);
}
export default {
  fetch: handle,
  // waitUntil keeps asynchronous report processing alive after the cron handler returns.
  async scheduled(controller, env, ctx) {
    ctx.waitUntil(
      runScheduledReports(env.DB, env).then((result) =>
        console.log("Scheduled reports processed", result),
      ),
    );
  },
};
