/**
 * Checks a user's login with Supabase before the server allows access to business records.
 * Requires a confirmed email address and rejects invalid login tokens.
 * Also links accounts imported from the earlier app, using mappings already saved in the
 * database. Profile names do not determine access.
 */
export class AuthUnavailable extends Error {}
// Accept only a secure login-service address and a key intended to be public. Reject private
// server keys so they cannot be sent to the browser.
export function authConfig(env) {
  const url = String(env.SUPABASE_URL || "").replace(/\/$/, "");
  const key = String(env.SUPABASE_PUBLISHABLE_KEY || "");
  if (!url || !key) return null;
  try {
    const parsed = new URL(url);
    if (
      parsed.protocol !== "https:" ||
      parsed.username ||
      parsed.password ||
      parsed.pathname !== "/" ||
      parsed.search ||
      parsed.hash
    )
      return null;
  } catch {
    return null;
  }
  if (key.startsWith("sb_secret_")) return null;
  // Older public keys are supported too. Read the key's declared role here only to reject a
  // private administrator key, not to identify a logged-in person.
  if (key.startsWith("eyJ")) {
    try {
      const encoded = key.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
      if (JSON.parse(atob(encoded)).role !== "anon") return null;
    } catch {
      return null;
    }
  } else if (!key.startsWith("sb_publishable_")) return null;
  return { url, key };
}
// Ask Supabase to verify the login token. Do not trust a user ID supplied in a request or
// merely read the contents of an unchecked login token.
export async function authenticatedUser(request, env) {
  const config = authConfig(env);
  if (!config) throw new AuthUnavailable("Email login is not configured yet.");
  const bearer = request.headers.get("Authorization") || "";
  if (!/^Bearer [A-Za-z0-9._~-]{1,8192}$/.test(bearer)) return null;
  let response;
  try {
    response = await fetch(config.url + "/auth/v1/user", {
      headers: { apikey: config.key, Authorization: bearer },
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    throw new AuthUnavailable("The login service is unavailable. Please retry.");
  }
  if (response.status === 401 || response.status === 403) return null;
  if (!response.ok) throw new AuthUnavailable("The login service is unavailable. Please retry.");
  let u;
  try {
    u = await response.json();
  } catch {
    throw new AuthUnavailable("The login service returned an invalid response.");
  }
  if (!u?.id || !u.email || !u.email_confirmed_at || u.is_anonymous) return null;
  return {
    userId: u.id,
    email: u.email.toLowerCase(),
    displayName: String(u.user_metadata?.full_name || u.email).slice(0, 120),
    fullName: u.user_metadata?.full_name || null,
  };
}
// When moving accounts from the old app, use only mappings prepared in the database.
// Supabase must confirm the user owns the mapped email address before their old
// business membership can be linked. A name or ID typed into a request is not enough.
export async function adoptMigratedIdentity(db, user) {
  const q = (sql, ...args) => db.prepare(sql).bind(...args);
  const mapping = await q(
    "SELECT old_user_id,claimed_by FROM legacy_identity_links WHERE email=?",
    user.email,
  ).first();
  if (!mapping || mapping.claimed_by === user.userId) return;
  if (mapping.claimed_by)
    throw new AuthUnavailable(
      "This migrated account is already linked. Contact the business owner.",
    );
  if (await q("SELECT id FROM accounts WHERE id=?", user.userId).first())
    throw new AuthUnavailable("Account migration needs owner review.");
  await db.batch([
    q("UPDATE accounts SET id=? WHERE id=?", user.userId, mapping.old_user_id),
    q("UPDATE memberships SET user_id=? WHERE user_id=?", user.userId, mapping.old_user_id),
    q("UPDATE businesses SET owner_id=? WHERE owner_id=?", user.userId, mapping.old_user_id),
    q(
      "UPDATE legacy_identity_links SET claimed_by=? WHERE email=? AND claimed_by IS NULL",
      user.userId,
      user.email,
    ),
  ]);
}
