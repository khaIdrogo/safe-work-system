'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
export default function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  return (
    <div className="max-w-md space-y-4">
      <h2 className="text-xl font-bold">Sign in</h2>
      <input placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <input placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
      <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded" onClick={async () => {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) alert(error.message); else window.location.href = '/dashboard';
      }}>Sign in</button>
      <p className="text-sm">No account? <Link href="/auth/signup" className="text-blue-600 underline">Sign up</Link></p>
    </div>
  );
}
