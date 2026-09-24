'use client';
import { useState, type FormEvent } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Frame } from '@/components/Frame';
import { Field } from '@/components/Field';
import { Button } from '@/components/Button';
import s from './login.module.css';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(''); setState('sending');
    const { error } = await createClient().auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) { setError('That email can’t sign in here.'); setState('idle'); return; }
    setState('sent');
  }

  return (
    <main className={s.page}>
      <Frame className={s.panel}>
        <h1 className={s.title}>Resource Manager</h1>
        {state === 'sent' ? (
          <p className={s.note}>Check your inbox. The sign-in link opens the app on this device.</p>
        ) : (
          <form onSubmit={submit} className={s.form}>
            <Field label="Email" type="email" required autoFocus autoComplete="email" value={email}
              onChange={(e) => setEmail(e.target.value)} error={error} />
            <Button type="submit" variant="primary" disabled={state === 'sending'}>
              {state === 'sending' ? 'Sending…' : 'Send sign-in link'}
            </Button>
          </form>
        )}
      </Frame>
    </main>
  );
}
