import { ArrowUpRight, Heart, Play, Images, BookHeart } from 'lucide-react'
import { Link } from 'react-router-dom'
import { publicNavLinks } from './publicNav'

const footerLinks = [
  {
    title: 'Watch the film',
    description: 'Revisit the ceremony, speeches, and the whole dance floor arc.',
    to: '/film',
    icon: Play,
  },
  {
    title: 'Browse the gallery',
    description: 'Portraits, candids, and every little detail we never want to forget.',
    to: '/gallery',
    icon: Images,
  },
  {
    title: 'Leave a note',
    description: 'A quiet last stop for one message, blessing, or little memory from the day.',
    to: '/guestbook',
    icon: BookHeart,
  },
] as const

export function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer
      data-testid="public-footer"
      className="relative overflow-hidden bg-gradient-to-b from-cream-100 to-cream-50 px-4 pb-10 pt-20"
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold-300/70 to-transparent" />
      <div className="absolute left-10 top-16 h-40 w-40 rounded-full bg-gold-200/35 blur-3xl" />
      <div className="absolute bottom-0 right-0 h-56 w-56 rounded-full bg-blush-200/30 blur-3xl" />

      <div className="relative mx-auto max-w-7xl">
        <div className="cinematic-panel px-6 py-8 sm:px-8 lg:px-10 lg:py-10">
          <div className="grid gap-10 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] xl:items-start">
            <div className="max-w-xl">
              <p className="text-[10px] uppercase tracking-[0.35em] text-gold-200">
                Austin and Jordyn
              </p>
              <h2 className="mt-4 font-display text-4xl text-cinematic-primary sm:text-5xl">
                Thanks for helping us keep the day alive.
              </h2>
              <p className="mt-4 max-w-lg text-sm leading-7 text-cinematic-secondary sm:text-base">
                The simplest way through is still the best one: watch the film, open the
                gallery when you want to linger, and leave a note only if you still have
                something to say before you go.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3 text-[11px] uppercase tracking-[0.28em] text-gold-200/80">
                <span>May 10, 2025</span>
                <span className="h-1 w-1 rounded-full bg-gold-400/60" />
                <span>The Lodge at Indian Lake</span>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-2">
              {footerLinks.map(({ title, description, to, icon: Icon }) => (
                <Link
                  key={to}
                  to={to}
                  className="group cinematic-card flex flex-col gap-2.5 p-3.5 transition-all duration-300 hover:-translate-y-0.5 hover:border-gold-300/45 hover:bg-white/9 sm:p-4"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-gold-200/14 bg-[rgba(255,247,235,0.08)] text-gold-300">
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <ArrowUpRight className="h-3 w-3 text-gold-300/60 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </div>
                  <p className="font-display text-sm leading-tight text-cinematic-primary sm:text-base">
                    {title}
                  </p>
                  <p className="hidden text-xs leading-5 text-cinematic-secondary sm:block">
                    {description}
                  </p>
                </Link>
              ))}
            </div>
          </div>

          <div className="mt-10 flex flex-col gap-4 border-t border-gold-200/18 pt-6 text-sm text-cinematic-secondary sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
              <div className="flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.22em] text-gold-100">
                {publicNavLinks.map((link) => (
                  <Link
                    key={link.path}
                    to={link.path}
                    className="rounded-full border border-gold-200/20 bg-[rgba(255,247,235,0.14)] px-3 py-1.5 transition-colors hover:border-gold-300/45 hover:text-gold-300"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
              <p className="flex items-center gap-2 font-medium text-gold-100/90">
                <span>Made with</span>
                <Heart className="h-3.5 w-3.5 shrink-0 fill-rose-400 text-rose-400" />
                <span>for the people who shared it with us</span>
              </p>
            </div>
            <p className="font-medium text-gold-100/90">© {currentYear} Austin & Jordyn</p>
          </div>
        </div>
      </div>
    </footer>
  )
}
