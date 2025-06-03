import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate('/admin');
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) navigate(location.state?.from?.pathname || '/admin');
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, [navigate, location]);

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
};

export default LoginPage;
