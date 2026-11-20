'use client';

import React, { useState } from 'react';

async function sessionRequest(action, body = {}) {
  const response = await fetch('/api/auth/' + action, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', 'X-AutoPay-Request': '1' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.error || 'The account service is unavailable. Please retry.');
  }
}

export function EmailSignIn({ returnTo }) {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (sent) {
        await sessionRequest('verify-code', { email, code });
        window.location.assign(returnTo);
      } else {
        await sessionRequest('request-code', { email });
        setSent(true);
      }
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit}>
      {error && <p className="error" role="alert">{error}</p>}
      {sent ? (
        <>
          <p role="status">Enter the sign-in code sent to {email}.</p>
          <label>
            Sign-in code
            <input
              required
              autoComplete="one-time-code"
              inputMode="numeric"
              pattern="[0-9]{6,10}"
              maxLength={10}
              value={code}
              onChange={event => setCode(event.target.value)}
            />
          </label>
        </>
      ) : (
        <label>
          Email address
          <input
            required
            type="email"
            autoComplete="email"
            maxLength={200}
            value={email}
            onChange={event => setEmail(event.target.value)}
          />
        </label>
      )}
      <button className="primary auth-continue" disabled={busy}>
        {sent ? (busy ? 'Verifying…' : 'Verify and sign in') : (busy ? 'Sending…' : 'Email me a code')}
      </button>
      {sent && (
        <button type="button" className="secondary" disabled={busy} onClick={() => {
          setSent(false);
          setCode('');
          setError('');
        }}>
          Change email or request a new code
        </button>
      )}
    </form>
  );
}

export function SignOutButton({ children, className }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function signOut() {
    setBusy(true);
    setError('');
    try {
      await sessionRequest('sign-out');
      window.location.assign('/login');
    } catch (failure) {
      setError(failure.message);
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" className={className} onClick={signOut} disabled={busy}>
        {busy ? 'Logging out…' : children}
      </button>
      {error && <p className="error" role="alert">{error}</p>}
    </>
  );
}
