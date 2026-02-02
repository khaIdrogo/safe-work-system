'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function SignUp() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const onSignUp = async () => {
    setErrorMsg(null);

    // Basic client-side validation (optional but user-friendly)
    if (!email || !password) {
      setErrorMsg('Please enter both email and password.');
      return;
    }
    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({ email, password });

      if (error) {
        setErrorMsg(error.message);
        return;
      }

      /**
       * If your Supabase project requires email confirmation:
       * - data.user will exist, but data.session may be null until the user confirms.
       * - You can redirect to a "check your email" screen instead of /dashboard if you prefer.
       */
      window.location.href = '/dashboard';
    } catch (e: any) {
      setErrorMsg(e?.message ?? 'Unexpected error during sign up.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md space-y-4">
      <h2 className="text-xl font-bold">Sign up</h2>

      <div className="space-y-2">
        <input
          placeholder="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded border px-3 py-2"
          autoComplete="email"
        />
        <input
          placeholder="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded border px-3 py-2"
          autoComplete="new-password"
        />
      </div>

      {errorMsg && (
        <p className="text-sm text-red-600" role="alert">
          {errorMsg}
        </p>
      )}

      <button
        onClick={onSignUp}
        disabled={loading}
        className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded disabled:opacity-50"
      >
        {loading ? 'Creating...' : 'Create account'}
      </button>
    </div>
  );
}
