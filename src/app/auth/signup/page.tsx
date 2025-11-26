'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
export default function SignUp() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  return (
    <div className="max-w-md space-y-4">
      <h2 className="text-xl font-bold">Sign up</h2>
      <input placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <input placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
      <button className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded" onClick={async () => {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) alert(error.message);
        else {
          await supabase.from('profiles').upsert({ id: data.user?.id, email, role: 'inspector' });
          window.location.href = '/dashboard';
        }
      }}>Create account</button>
    </div>
  );
}
