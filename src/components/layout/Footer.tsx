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
    title: 'Read the guestbook',
    description: 'Messages, replies, voice notes, and all the warmth from our people.',
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
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:items-start">
            <div className="max-w-xl">
              <p className="text-[10px] uppercase tracking-[0.35em] text-gold-300/80">
                Austin and Jordyn
              </p>
              <h2 className="mt-4 font-display text-4xl text-cinematic-primary sm:text-5xl">
                Thanks for helping us keep the day alive.
              </h2>
              <p className="mt-4 max-w-lg text-sm leading-7 text-cinematic-secondary sm:text-base">
                This site is our favorite way to revisit the celebration, and it only feels
                complete because you were part of it. Come back anytime to watch, browse,
                read, or add your side of the story.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3 text-[11px] uppercase tracking-[0.28em] text-gold-300/75">
                <span>May 10, 2025</span>
                <span className="h-1 w-1 rounded-full bg-gold-400/60" />
                <span>The Lodge at Indian Lake</span>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {footerLinks.map(({ title, description, to, icon: Icon }) => (
                <Link
                  key={to}
                  to={to}
                  className="group cinematic-card p-5 transition-all duration-300 hover:-translate-y-1 hover:border-gold-300/45 hover:bg-white/9"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-gold-200/14 bg-[rgba(255,247,235,0.08)] text-gold-300">
                      <Icon className="h-5 w-5" />
                    </div>
                    <ArrowUpRight className="h-4 w-4 text-gold-300/70 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </div>
                  <p className="mt-6 font-display text-2xl leading-none text-cinematic-primary">
                    {title}
                  </p>
                  <p className="mt-3 text-sm leading-6 text-cinematic-secondary">
                    {description}
                  </p>
                </Link>
              ))}
            </div>
          </div>

          <div className="mt-10 flex flex-col gap-4 border-t border-gold-200/12 pt-6 text-xs text-cinematic-muted sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
              <div className="flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.24em] text-cinematic-muted">
                {publicNavLinks.map((link) => (
                  <Link
                    key={link.path}
                    to={link.path}
                    className="rounded-full border border-gold-200/12 bg-[rgba(255,247,235,0.08)] px-3 py-1.5 transition-colors hover:border-gold-300/35 hover:text-gold-300"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
              <p className="flex items-center gap-1.5">
                Made with <Heart className="h-3.5 w-3.5 fill-rose-400 text-rose-400" /> for the people who shared it with us
              </p>
            </div>
            <p>© {currentYear} Austin & Jordyn</p>
          </div>
        </div>
      </div>
    </footer>
  )
}
