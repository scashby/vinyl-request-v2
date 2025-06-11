// Admin Login page ("/admin/login")
// Authenticates admins with magic link or Google, using Supabase

"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from 'lib/supabaseClient'

export default function Page() {
  const [email, setEmail] = useState('');
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.push('/admin');
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) router.push('/admin');
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, [router]);

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    const { error } = await supabase.auth.signInWithOtp({ email });
    if (error) alert('Login error: ' + error.message);
    else alert('Check your email for a magic login link.');
  };

  const handleGoogleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: 'https://deadwaxdialogues.com/admin'
      }
    });
    if (error) alert('Google login error: ' + error.message);
  };

  return (
    <div style={{
      maxWidth: '400px',
      margin: '4rem auto',
      padding: '2rem',
      border: '1px solid #ccc',
      borderRadius: '8px',
      backgroundColor: '#fff',
      color: '#000'
    }}>
      <h2 style={{ marginBottom: '1rem' }}>Admin Login</h2>
      <form onSubmit={handleEmailLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <label>Email (magic link):</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <button type="submit" style={{ backgroundColor: '#2563eb', color: '#fff', padding: '0.5rem', border: 'none' }}>
          Send Magic Link
        </button>
      </form>
      <hr style={{ margin: '1.5rem 0' }} />
      <button onClick={handleGoogleLogin} style={{
        backgroundColor: '#db4437',
        color: '#fff',
        padding: '0.5rem',
        border: 'none',
        width: '100%'
      }}>
        Sign in with Google
      </button>
    </div>
  );
}
