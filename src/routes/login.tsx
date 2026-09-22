import {createFileRoute, redirect, useNavigate} from '@tanstack/react-router';
import {useState} from 'react';
import type {FormEvent} from 'react';

import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {isSignedIn, signIn} from '@/modules/auth/session';
import {gensetSearch} from '@/modules/genset/types/view.type';

import gensetiqWordmark from '@/assets/gensetiq-wordmark-light.svg';

import {BRAND} from '@/brands';

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
    // The register. It was `/sites` until 2026-09-22, on the argument that a
    // permanent estate's reader arrives asking about a yard — an argument that
    // went when the site pages did. A machine is what this product is about.
    void navigate({to: '/gensets', search: gensetSearch({})});
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas p-6">
      <div className="flex w-[373px] flex-col items-center gap-[71px]">
        {/* The customer's own mark carries the door; the product signs underneath.
            The wordmark is the brand SVG from the deck assets — black "genset", teal
            "IQ", drawn for a light ground. The prototype's own PNG is the dark-ground
            inversion (teal "genset", white "IQ") and half of it vanishes here.

            On the unbranded build the customer's mark *is* the gensetIQ wordmark, so
            the sign-off is dropped rather than printed twice. A door that read
            "gensetIQ, powered by gensetIQ" is the failure mode of a white label with
            nobody in the white. */}
        <div className="flex flex-col items-center gap-3">
          {/* Sized by the artwork's own shape, not by one hardcoded width.
              
              `w-60` was that width, and it is right for a *lockup* — four-or-more to
              one, a name set on a line. Express Mission's identity is a round badge
              at 48px, and 240px of it was a five-times upscale of a raster: the door
              opened on a blurred logo, which is the one thing a login screen must not
              do. So a wide mark takes the lockup width and a square one is drawn at
              the size it was made, which is small and sharp rather than large and
              soft. */}
          <img
            src={BRAND.logo}
            alt={BRAND.name}
            width={BRAND.logoSize.width}
            height={BRAND.logoSize.height}
            className="object-contain"
            style={
              BRAND.logoSize.width / BRAND.logoSize.height >= 2
                ? {width: '15rem'}
                : {width: BRAND.logoSize.width, height: BRAND.logoSize.height}
            }
          />
          {BRAND.id !== 'gensetiq' && (
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
          )}
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
    throw redirect({to: '/gensets', search: gensetSearch({})});
  },
  component: LoginPage,
});
