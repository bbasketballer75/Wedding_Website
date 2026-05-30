import { useMemo, useState } from 'react'
import { Navigate, Link, useLocation, useNavigate } from 'react-router-dom'
import { LockKeyhole, ShieldAlert, ShieldCheck, ArrowLeft, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import SEOHead from '@/components/seo/SEOHead'
import { useToast } from '@/context/ToastContext'
import { useAuthStore } from '@/stores/authStore'

type AdminLoginLocationState = {
  from?: string
}

export default function AdminLogin() {
  const navigate = useNavigate()
  const location = useLocation()
  const { addToast } = useToast()
  const { signIn, signOut, isLoading, isAuthenticated, isAdmin, user } = useAuthStore()

  const [email, setEmail] = useState(user?.email ?? '')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const locationState = (location.state as AdminLoginLocationState | null) ?? null
  const destination = useMemo(() => {
    if (locationState?.from && locationState.from.startsWith('/admin')) {
      return locationState.from
    }

    return '/admin'
  }, [locationState?.from])

  if (!isLoading && isAuthenticated && isAdmin) {
    return <Navigate to={destination} replace />
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!email.trim() || !password.trim()) {
      addToast('Enter your email and password to continue.', 'warning')
      return
    }

    setSubmitting(true)
    const result = await signIn(email.trim(), password)
    setSubmitting(false)

    if (!result.success) {
      addToast(result.error || 'Unable to sign in right now.', 'error')
      return
    }

    addToast('Signed in successfully.', 'success')
    navigate(destination, { replace: true })
  }

  const handleSignOut = async () => {
    await signOut()
    setPassword('')
    addToast('Signed out successfully.', 'success')
  }

  return (
    <div className='relative min-h-screen overflow-hidden bg-cream-50'>
      <SEOHead
        title='Admin Login'
        description='Secure admin access for the Austin and Jordyn wedding site.'
        canonical='/admin/login'
        noIndex
      />

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
              <Button variant='secondary' to='/'>
                <ArrowLeft className='h-4 w-4' />
                Back to site
              </Button>
              <Button variant='ghost' asChild>
                <Link to={destination}>Go to requested admin page</Link>
              </Button>
            </div>
          </section>

          <section className='editorial-panel px-6 py-8 sm:px-8 sm:py-10'>
            {!isAuthenticated ? (
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

                <form className='mt-8 space-y-5' onSubmit={handleSubmit}>
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
                    <span className='font-semibold text-charcoal-800'> {user?.email}</span>.
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

                <div className='mt-6 flex flex-wrap gap-3'>
                  <Button variant='secondary' onClick={handleSignOut}>
                    <LogOut className='h-4 w-4' />
                    Sign Out
                  </Button>
                  <Button variant='ghost' asChild>
                    <Link to='/'>Return to home</Link>
                  </Button>
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
