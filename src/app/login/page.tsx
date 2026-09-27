'use client';
import { useState, type FormEvent } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Frame } from '@/components/Frame';
import { Field } from '@/components/Field';
import { Button } from '@/components/Button';
import s from './login.module.css';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(''); setBusy(true);
    const { error } = await createClient().auth.signInWithPassword({ email: email.trim(), password });
    if (error) { setError(error.message); setBusy(false); return; }
    // Full navigation so the proxy sees the new session cookie.
    window.location.assign('/');
  }

  return (
    <main className={s.page}>
      <Frame className={s.panel}>
        <h1 className={s.title}>Resource Manager</h1>
        <form onSubmit={submit} className={s.form}>
          <Field label="Email" type="email" required autoFocus autoComplete="email" value={email}
            onChange={(e) => setEmail(e.target.value)} />
          <Field label="Password" type="password" required autoComplete="current-password" value={password}
            onChange={(e) => setPassword(e.target.value)} error={error} />
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      </Frame>
    </main>
  );
}
