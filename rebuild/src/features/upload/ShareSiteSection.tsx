import { motion } from 'framer-motion'
import { Check, Copy, Link2, Mail, MessageCircle, Share2 } from 'lucide-react'
import { SocialPlatformIcon } from '@/shared/ui'
import { useShareSite, type UseShareSiteOptions } from './useShareSite'

export interface ShareSiteSectionProps {
  share?: UseShareSiteOptions
}

/** Frozen `ShareSiteSection` (`src/pages/upload/ShareSiteSection.tsx`) port. */
export function ShareSiteSection({ share }: ShareSiteSectionProps) {
  const {
    siteShareUrl,
    siteShareTitle,
    siteShareDescription,
    siteCopied,
    handleCopyShareLink,
    openShareWindow,
  } = useShareSite(share)

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      data-testid='share-site-section'
      className='mt-8 relative overflow-hidden rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 px-6 py-6 sm:px-8'
    >
      <div className='flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between'>
        <div className='max-w-xl'>
          <p className='text-[10px] uppercase tracking-[0.3em] text-gold-400'>
            Pass the site along
          </p>
          <p className='mt-3 text-lg font-semibold text-white'>
            Send the full site to anyone who still has not watched or browsed yet.
          </p>
          <p className='mt-2 text-sm leading-6 text-white/55'>
            These buttons share the site itself. Uploads still happen separately above.
          </p>
        </div>

        <div className='flex flex-wrap gap-2 items-center'>
          <button
            type='button'
            onClick={() => void handleCopyShareLink()}
            className='flex h-10 w-10 items-center justify-center rounded-full border border-white/12 bg-white/6 text-white/60 transition-all hover:border-gold-400/30 hover:text-gold-300 hover:bg-white/10'
            aria-label={siteCopied ? 'Copied' : 'Copy link'}
          >
            {siteCopied ? (
              <Check className='h-4 w-4' aria-hidden='true' />
            ) : (
              <Copy className='h-4 w-4' aria-hidden='true' />
            )}
          </button>
          <button
            type='button'
            onClick={() => {
              const body = encodeURIComponent(
                `${siteShareTitle} — ${siteShareDescription} ${siteShareUrl}`
              )
              if (typeof window !== 'undefined') window.location.href = `sms:?&body=${body}`
            }}
            className='flex h-10 w-10 items-center justify-center rounded-full border border-white/12 bg-white/6 text-white/60 transition-all hover:border-gold-400/30 hover:text-gold-300 hover:bg-white/10'
            aria-label='Text it'
          >
            <MessageCircle className='h-4 w-4' aria-hidden='true' />
          </button>
          <button
            type='button'
            onClick={() =>
              openShareWindow(
                `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(siteShareUrl)}`
              )
            }
            className='flex h-10 w-10 items-center justify-center rounded-full border border-white/12 bg-white/6 text-white/60 transition-all hover:border-gold-400/30 hover:text-gold-300 hover:bg-white/10'
            aria-label='Share on Facebook'
          >
            <SocialPlatformIcon platform='facebook' className='h-4 w-4' />
          </button>
          <button
            type='button'
            onClick={() =>
              openShareWindow(
                `https://twitter.com/intent/tweet?text=${encodeURIComponent(`${siteShareTitle} — ${siteShareDescription}`)}&url=${encodeURIComponent(siteShareUrl)}`
              )
            }
            className='flex h-10 w-10 items-center justify-center rounded-full border border-white/12 bg-white/6 text-white/60 transition-all hover:border-gold-400/30 hover:text-gold-300 hover:bg-white/10'
            aria-label='Share on X'
          >
            <SocialPlatformIcon platform='twitter' className='h-4 w-4' />
          </button>
          <button
            type='button'
            onClick={() => {
              const subject = encodeURIComponent(siteShareTitle)
              const body = encodeURIComponent(`${siteShareDescription}\n\n${siteShareUrl}`)
              if (typeof window !== 'undefined')
                window.location.href = `mailto:?subject=${subject}&body=${body}`
            }}
            className='flex h-10 w-10 items-center justify-center rounded-full border border-white/12 bg-white/6 text-white/60 transition-all hover:border-gold-400/30 hover:text-gold-300 hover:bg-white/10'
            aria-label='Share via email'
          >
            <Mail className='h-4 w-4' aria-hidden='true' />
          </button>
          {typeof navigator !== 'undefined' && navigator.share && (
            <button
              type='button'
              onClick={() => {
                void navigator
                  .share({
                    title: siteShareTitle,
                    text: siteShareDescription,
                    url: siteShareUrl,
                  })
                  .catch(() => undefined)
              }}
              className='flex h-10 w-10 items-center justify-center rounded-full border border-white/12 bg-white/6 text-white/60 transition-all hover:border-gold-400/30 hover:text-gold-300 hover:bg-white/10'
              aria-label='More share options'
            >
              <Share2 className='h-4 w-4' aria-hidden='true' />
            </button>
          )}
          <div className='inline-flex min-h-[2.5rem] items-center gap-2 rounded-full border border-white/12 bg-white/6 px-4 py-2 text-sm'>
            <Link2 className='h-4 w-4 text-gold-400' aria-hidden='true' />
            <span className='max-w-[11rem] truncate sm:max-w-[13rem] text-white/40'>
              {siteShareUrl}
            </span>
          </div>
        </div>
      </div>
    </motion.section>
  )
}
