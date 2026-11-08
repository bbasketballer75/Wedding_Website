/**
 * Admin sign-in, ported from the frozen `src/pages/AdminLogin.tsx`.
 *
 * Frozen contract preserved: the two-panel editorial layout and all copy;
 * email/password form; invalid-credentials failure copy; authenticated-but-not-
 * admin upgrade instructions; already-admin redirect to the requested admin URL
 * with `from` limited to `/admin*` (open-redirect guard); `noindex` metadata.
 *
 * DELTAS (documented in the W7-1 report):
 * - the frozen toast provider does not exist in the rebuild yet, so feedback is
 *   an inline `role=alert`/`role=status` message;
 * - the destination is carried as `?from=/admin/...` (visible, testable,
 *   bookmarkable) instead of react-router location state; the guard is identical;
 * - the frozen copy says "user metadata" while the authoritative check (and the
 *   frozen `authStore`) uses `app_metadata.role`; the copy is kept byte-identical
 *   for text parity and the implementation reads app_metadata only (A4 §2).
 */
import { ArrowLeft, LockKeyhole, LogOut, ShieldAlert, ShieldCheck } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useRouterState } from '@tanstack/react-router'
import { usePageMeta } from '@/app/seo/usePageMeta'
import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Input'
import { Label } from '@/shared/ui/Label'
import { useAdminAuth } from './auth-context'
import { AdminAuthProvider } from './auth'
import type { AdminRuntime } from './data'
import { AdminDestinationLink } from './AdminLinks'
import {
  adminSectionFromPathname,
  navigateToAdminSection,
  parseAdminLoginFrom,
  useAdminNavigate,
} from './routing'
import { getDefaultAdminRuntime } from './runtime'

const LOGIN_META = {
  title: 'Admin Login',
  description: 'Secure admin access for the Austin and Jordyn wedding site.',
  canonical: '/admin/login',
  noIndex: true,
} as const

interface AdminLoginScreenProps {
  destination: string
}

function AdminLoginScreen({ destination }: AdminLoginScreenProps) {
  const auth = useAdminAuth()
  const navigate = useAdminNavigate()
  const [email, setEmail] = useState(auth.user?.email ?? '')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const hasRedirectedRef = useRef(false)

  usePageMeta(LOGIN_META)

  // Already-admin: honour the requested admin URL (limited to /admin* by parse).
  // The ref guard keeps the redirect single-shot: the login route can re-render
  // once more while the replace navigation settles (with an empty from), and a
  // second navigate would overwrite the requested destination with /admin.
  useEffect(() => {
    if (hasRedirectedRef.current) return
    if (auth.isLoading || !auth.isAuthenticated || !auth.isAdmin) return
    hasRedirectedRef.current = true
    navigateToAdminSection(navigate, adminSectionFromPathname(destination), { replace: true })
  }, [auth.isAdmin, auth.isAuthenticated, auth.isLoading, destination, navigate])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage(null)
    setStatusMessage(null)

    if (!email.trim() || !password.trim()) {
      setErrorMessage('Enter your email and password to continue.')
      return
    }

    setSubmitting(true)
    const result = await auth.signIn(email.trim(), password)
    setSubmitting(false)

    if (!result.success) {
      setErrorMessage(result.error ?? 'Unable to sign in right now.')
      return
    }

    setPassword('')
    setStatusMessage('Signed in successfully.')
  }

  const handleSignOut = async () => {
    setErrorMessage(null)
    setStatusMessage(null)
    try {
      await auth.signOut()
      setPassword('')
      setStatusMessage('Signed out successfully.')
    } catch {
      setErrorMessage('Could not sign out. Please try again.')
    }
  }

  return (
    <div className='relative min-h-screen overflow-hidden bg-cream-50'>
      <div
        aria-hidden='true'
        className='pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(201,160,92,0.24),_transparent_42%),linear-gradient(180deg,_rgba(255,250,245,0.98),_rgba(249,244,236,1))]'
      />
      <div
        aria-hidden='true'
        className='pointer-events-none absolute left-1/2 top-0 h-[24rem] w-[24rem] -translate-x-1/2 rounded-full bg-gold-200/20 blur-3xl'
      />

      <div className='relative mx-auto flex min-h-screen w-full max-w-6xl items-center px-4 py-16 sm:px-6 lg:px-8'>
        <div className='grid w-full gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-10'>
          <section className='editorial-panel flex flex-col justify-between px-6 py-8 sm:px-8 sm:py-10'>
            <div className='space-y-6'>
              <span className='eyebrow-chip'>
                <ShieldCheck className='h-3.5 w-3.5' />
                Protected access
              </span>

              <div className='space-y-4'>
                <h1 className='font-display text-4xl text-charcoal-900 sm:text-5xl'>
                  Admin sign in
                </h1>
                <p className='max-w-2xl text-base leading-7 text-charcoal-600 sm:text-lg'>
                  Use the Supabase email and password for your admin account to review uploads,
                  moderate the guestbook, and manage the wedding archive.
                </p>
              </div>

              <div className='grid gap-4 sm:grid-cols-2'>
                <div className='rounded-[2rem] border border-gold-200/70 bg-white/80 p-5 shadow-[0_24px_48px_rgba(80,62,32,0.08)]'>
                  <p className='text-xs font-semibold uppercase tracking-[0.18em] text-charcoal-500'>
                    What this uses
                  </p>
                  <p className='mt-3 text-sm leading-6 text-charcoal-600'>
                    The same Supabase authentication already wired into the app. There are no
                    hardcoded admin credentials in the codebase.
                  </p>
                </div>
                <div className='rounded-[2rem] border border-gold-200/70 bg-white/80 p-5 shadow-[0_24px_48px_rgba(80,62,32,0.08)]'>
                  <p className='text-xs font-semibold uppercase tracking-[0.18em] text-charcoal-500'>
                    Admin role check
                  </p>
                  <p className='mt-3 text-sm leading-6 text-charcoal-600'>
                    Access is granted only when the signed-in user has
                    <span className='font-semibold text-charcoal-800'> `role: admin` </span>
                    in Supabase user metadata.
                  </p>
                </div>
              </div>

              <div className='rounded-[2rem] border border-gold-200/70 bg-gold-50/70 px-5 py-4 text-sm leading-6 text-charcoal-600'>
                <p className='font-medium text-charcoal-800'>Next configuration step</p>
                <p className='mt-1'>
                  Once you can sign in here, we can set your Supabase user metadata so this page
                  upgrades from “authenticated” to full admin access.
                </p>
              </div>
            </div>

            <div className='mt-8 flex flex-wrap gap-3'>
              <a
                href='/'
                className='inline-flex max-w-full items-center justify-center gap-2 rounded-full border border-[color:var(--ui-border)] px-5 py-3 text-sm font-medium text-[color:var(--ui-accent-strong)] transition-colors hover:bg-[color:var(--ui-surface-elevated)]'
              >
                <ArrowLeft className='h-4 w-4' aria-hidden='true' />
                Back to site
              </a>
              <AdminDestinationLink
                destination={destination}
                className='inline-flex max-w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-medium text-[color:var(--ui-accent-strong)] transition-colors hover:bg-[color:var(--ui-surface-elevated)]'
              >
                Go to requested admin page
              </AdminDestinationLink>
            </div>
          </section>

          <section className='editorial-panel px-6 py-8 sm:px-8 sm:py-10'>
            {!auth.isAuthenticated ? (
              <>
                <span className='eyebrow-chip'>
                  <LockKeyhole className='h-3.5 w-3.5' />
                  Account access
                </span>
                <div className='mt-6 space-y-2'>
                  <h2 className='font-display text-3xl text-charcoal-900'>Sign in to continue</h2>
                  <p className='text-sm leading-6 text-charcoal-600'>
                    Enter the email and password for the Supabase user you just created.
                  </p>
                </div>

                <form className='mt-8 space-y-5' onSubmit={event => void handleSubmit(event)}>
                  <div>
                    <Label htmlFor='admin-login-email'>Email</Label>
                    <Input
                      id='admin-login-email'
                      type='email'
                      autoComplete='email'
                      inputMode='email'
                      placeholder='you@example.com'
                      value={email}
                      onChange={event => setEmail(event.target.value)}
                      disabled={submitting}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor='admin-login-password'>Password</Label>
                    <Input
                      id='admin-login-password'
                      type='password'
                      autoComplete='current-password'
                      placeholder='Enter your password'
                      value={password}
                      onChange={event => setPassword(event.target.value)}
                      disabled={submitting}
                      required
                    />
                  </div>

                  {errorMessage && (
                    <p role='alert' className='text-sm text-rose-700'>
                      {errorMessage}
                    </p>
                  )}
                  {statusMessage && (
                    <p role='status' className='text-sm text-emerald-700'>
                      {statusMessage}
                    </p>
                  )}

                  <Button
                    data-testid='admin-login-submit'
                    type='submit'
                    size='lg'
                    className='w-full'
                    isLoading={submitting}
                  >
                    Sign In
                  </Button>
                </form>
              </>
            ) : (
              <>
                <span className='eyebrow-chip'>
                  <ShieldAlert className='h-3.5 w-3.5' />
                  Authenticated, awaiting admin role
                </span>
                <div className='mt-6 space-y-3'>
                  <h2 className='font-display text-3xl text-charcoal-900'>
                    You are signed in, but not an admin yet
                  </h2>
                  <p className='text-sm leading-6 text-charcoal-600'>
                    This account is working. The last step is adding
                    <span className='font-semibold text-charcoal-800'> `role: admin` </span>
                    to the user metadata for
                    <span className='font-semibold text-charcoal-800'> {auth.user?.email}</span>.
                  </p>
                </div>

                <div className='mt-8 rounded-[2rem] border border-gold-200/70 bg-white/80 p-5'>
                  <p className='text-xs font-semibold uppercase tracking-[0.18em] text-charcoal-500'>
                    Supabase metadata target
                  </p>
                  <pre className='mt-3 overflow-x-auto rounded-2xl bg-charcoal-950 px-4 py-4 text-sm text-gold-100'>
                    {`{
  "role": "admin"
}`}
                  </pre>
                </div>

                {errorMessage && (
                  <p role='alert' className='mt-4 text-sm text-rose-700'>
                    {errorMessage}
                  </p>
                )}
                {statusMessage && (
                  <p role='status' className='mt-4 text-sm text-emerald-700'>
                    {statusMessage}
                  </p>
                )}

                <div className='mt-6 flex flex-wrap gap-3'>
                  <Button variant='secondary' onClick={() => void handleSignOut()}>
                    <LogOut className='h-4 w-4' aria-hidden='true' />
                    Sign Out
                  </Button>
                  <a
                    href='/'
                    className='inline-flex max-w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-medium text-[color:var(--ui-accent-strong)] transition-colors hover:bg-[color:var(--ui-surface-elevated)]'
                  >
                    Return to home
                  </a>
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}

export interface AdminLoginPageProps {
  runtime?: AdminRuntime
}

/**
 * Route component for `/admin/login` (Lead wires it).
 *
 * Reads `?from=` via TanStack Router state, then renders the auth-bound screen.
 */
export function AdminLoginPage({ runtime }: AdminLoginPageProps) {
  const resolvedRuntime = runtime ?? getDefaultAdminRuntime()
  const searchStr = useRouterState({ select: state => state.location.searchStr })
  const destination = parseAdminLoginFrom(searchStr)

  return (
    <AdminAuthProvider auth={resolvedRuntime.auth}>
      <AdminLoginScreen destination={destination} />
    </AdminAuthProvider>
  )
}
