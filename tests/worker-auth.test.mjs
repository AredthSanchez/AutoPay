import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { Miniflare } from 'miniflare';

test('Worker verifies email sessions and rejects untrusted identity headers', async () => {
  const email = 'owner@example.com';
  const user = {
    id: '4ebc1016-db19-44fb-8b9f-30909d949e9b',
    aud: 'authenticated',
    role: 'authenticated',
    email,
    email_confirmed_at: '2026-10-01T12:00:00Z',
    app_metadata: {},
    user_metadata: {},
    created_at: '2026-10-01T12:00:00Z',
  };
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const token = encode({ alg: 'HS256', typ: 'JWT' }) + '.' + encode({
    sub: user.id, email, exp: Math.floor(Date.now() / 1000) + 3600,
  }) + '.synthetic';
  const providerRequests = [];
  const modulesRoot = resolve('dist/server');
  const files = await readdir(modulesRoot, { recursive: true });
  const modules = ['index.js', ...files.filter(file => file !== 'index.js' && file.endsWith('.js'))];
  const mf = new Miniflare({
    modulesRoot,
    modules: modules.map(path => ({ type: 'ESModule', path: resolve(modulesRoot, path) })),
    compatibilityDate: '2026-05-15',
    compatibilityFlags: ['nodejs_compat'],
    d1Databases: ['DB'],
    r2Buckets: ['BUCKET'],
    bindings: { SUPABASE_URL: 'https://supabase.example', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test' },
    outboundService: async request => {
      const url = new URL(request.url);
      const action = url.pathname.split('/').at(-1);
      providerRequests.push(action);
      assert.equal(url.origin, 'https://supabase.example');
      if (action === 'otp') {
        assert.equal((await request.json()).email, email);
        return Response.json({});
      }
      if (action === 'verify') {
        const input = await request.json();
        assert.equal(input.type, 'email');
        if (input.token !== '123456') return Response.json({ code: 'otp_expired', message: 'Expired' }, { status: 403 });
        return Response.json({ access_token: token, token_type: 'bearer', refresh_token: 'synthetic_refresh', expires_in: 3600, user });
      }
      assert.equal(request.headers.get('authorization'), 'Bearer ' + token);
      if (action === 'user') return Response.json(user);
      if (action === 'logout') return new Response(null, { status: 204 });
      throw new Error('Unexpected request ' + request.url);
    },
  });

  try {
    const database = await mf.getD1Database('DB');
    for (const file of (await readdir('drizzle')).filter(file => file.endsWith('.sql')).sort()) {
      const sql = await readFile(resolve('drizzle', file), 'utf8');
      for (const statement of sql.split('--> statement-breakpoint').map(s => s.trim()).filter(Boolean)) {
        await database.prepare(statement).run();
      }
    }
    const origin = 'https://autopay.example';
    const api = (path, options = {}) => mf.dispatchFetch(origin + '/api/' + path, options);
    const post = (path, data, requestOrigin = origin, cookie) => api(path, {
      method: 'POST',
      headers: { origin: requestOrigin, 'X-AutoPay-Request': '1', 'Content-Type': 'application/json', ...(cookie && { cookie }) },
      body: JSON.stringify(data),
    });
    assert.equal((await api('auth/me', { headers: {
      'oai-authenticated-user-id': user.id, 'oai-authenticated-user-email': email,
    } })).status, 401);
    assert.equal((await post('auth/request-code', { email }, 'https://elsewhere.example')).status, 403);
    assert.equal((await post('auth/request-code', { email })).status, 200);
    assert.equal((await post('auth/verify-code', { email, code: '654321' })).status, 401);
    const verified = await post('auth/verify-code', { email, code: '123456' });
    assert.equal(verified.status, 200, await verified.text());
    assert.ok(verified.headers.getSetCookie().length > 0, 'verify sends a cookie');
    const cookies = verified.headers.getSetCookie();
    assert.ok(cookies.some(value => /__Host-autopay-session.*HttpOnly.*Secure/i.test(value) || /__Host-autopay-session.*Secure.*HttpOnly/i.test(value)));
    const cookie = cookies.map(value => value.split(';')[0]).join('; ');
    const me = await api('auth/me', { headers: { cookie } });
    assert.equal(me.status, 200, await me.clone().text());
    assert.equal((await me.json()).identity.email, email);
    const registration = await post('auth/register', { name: 'Owner', businessName: 'Example', ownerName: 'Owner' }, origin, cookie);
    assert.equal(registration.status, 201, await registration.text());
    const out = await post('auth/sign-out', {}, origin, cookie);
    assert.equal(out.status, 200, await out.text());
    assert.ok(out.headers.getSetCookie().some(value => /Max-Age=0/i.test(value)));
    assert.deepEqual(providerRequests, ['otp', 'verify', 'verify', 'user', 'user', 'logout']);
  } finally {
    await mf.dispose();
  }
});
