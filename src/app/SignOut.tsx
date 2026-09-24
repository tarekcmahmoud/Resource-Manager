'use client';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/Button';

export function SignOut() {
  return (
    <Button size="sm" onClick={async () => { await createClient().auth.signOut(); window.location.href = '/login'; }}>
      Sign out
    </Button>
  );
}
