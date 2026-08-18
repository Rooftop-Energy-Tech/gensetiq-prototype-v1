import {createFileRoute, redirect, useNavigate} from '@tanstack/react-router';
import {useState} from 'react';
import type {FormEvent} from 'react';

import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {isSignedIn, signIn} from '@/modules/auth/session';
import {DEFAULT_GENSET_ID} from '@/modules/genset/data/fleet';
import {gensetSearch} from '@/modules/genset/types/view.type';

import gensetiqWordmark from '@/assets/gensetiq-wordmark-light.png';
import sesbLogo from '@/assets/sesb-logo.png';

const LoginPage = () => {
  const navigate = useNavigate();
  const {redirect: redirectTo} = Route.useSearch();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    // There's no auth service behind this — the check exists so the empty-form
    // case has somewhere sensible to land rather than dropping into the app.
    if (email.trim() === '' || password === '') {
      setError('Enter an email and password to continue.');
      return;
    }

    signIn(email.trim());

    if (redirectTo !== undefined) {
      void navigate({href: redirectTo});
      return;
    }
    void navigate({to: '/gensets', search: gensetSearch({id: DEFAULT_GENSET_ID})});
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas p-6">
      <div className="flex w-[373px] flex-col items-center gap-[71px]">
        {/* The customer's own mark carries the door; the product signs underneath.
            The shipped wordmark is teal-and-white for a dark ground, so the sign-off
            uses `gensetiq-wordmark-light.png` — the same art with its white recoloured
            to the light theme's ink (see scripts note in the asset's commit). */}
        <div className="flex flex-col items-center gap-3">
          <img
            src={sesbLogo}
            alt="Sabah Electricity"
            width={240}
            height={80}
            className="h-20 w-60 object-contain"
          />
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-tertiary">Powered by</span>
            <img
              src={gensetiqWordmark}
              alt="gensetIQ"
              width={67}
              height={16}
              className="h-4 w-auto"
            />
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex w-full flex-col items-center gap-8" noValidate>
          <div className="flex w-full flex-col gap-4">
            <Input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Email"
              aria-label="Email"
              autoComplete="username"
            />
            <Input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Password"
              aria-label="Password"
              autoComplete="current-password"
            />
          </div>

          {error !== null && (
            <p role="alert" className="-my-4 w-full text-sm text-destructive">
              {error}
            </p>
          )}

          <Button type="submit" size="lg" className="w-full">
            Login
          </Button>

          <Button type="button" variant="ghost" size="sm" className="h-8 text-secondary">
            Forgot your password?
          </Button>
        </form>
      </div>
    </main>
  );
};

export const Route = createFileRoute('/login')({
  validateSearch: (search: Record<string, unknown>): {redirect?: string} => ({
    redirect: typeof search.redirect === 'string' ? search.redirect : undefined,
  }),
  beforeLoad: ({search}) => {
    if (!isSignedIn()) return;
    if (search.redirect !== undefined) throw redirect({href: search.redirect});
    throw redirect({to: '/gensets', search: gensetSearch({id: DEFAULT_GENSET_ID})});
  },
  component: LoginPage,
});
