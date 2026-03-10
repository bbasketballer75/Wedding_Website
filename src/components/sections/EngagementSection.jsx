import { photos, storyContent } from '@/data/engagement'
import { motion, useInView } from 'framer-motion'
import { useRef, useState } from 'react'
import EngagementGallery from './engagement/EngagementGallery'
import EngagementModal from './engagement/EngagementModal'
import HalloweenAudio from './engagement/HalloweenAudio'
import ProposalPolaroid from './engagement/ProposalPolaroid'
import SpiderWebs from './engagement/SpiderWebs'
import VolumetricFog from './engagement/VolumetricFog'

const EngagementSection = () => {
  const [selectedPhoto, setSelectedPhoto] = useState(null)
  const sectionRef = useRef(null)
  // Unmount sooner when scrolling down (negative bottom margin)
  const isInView = useInView(sectionRef, { amount: 0, margin: '0px 0px -20% 0px' })

  const mainPhoto = photos.find(p => p.type === 'main')
  const secondaryPhoto = photos.find(p => p.type === 'filler')

  return (
    <section
      ref={sectionRef}
      id='engagement-section'
      className='relative pt-12 pb-24 bg-neutral-950 overflow-visible'
    >
      {/* Top Transition Connector */}
      <div className='absolute -top-12 left-1/2 -translate-x-1/2 w-px h-12 bg-linear-to-b from-gold-500/50 via-orange-500 to-transparent z-20' />
      {/* Background Atmosphere */}
      <div className='absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,107,53,0.15)_0%,transparent_60%)] pointer-events-none' />

      {/* Spooky Decorations - Only render when in view to prevent main thread blocking */}
      {isInView && (
        <>
          <VolumetricFog visible={true} />
          <SpiderWebs visible={true} />
        </>
      )}

      <div className='container-custom relative z-10'>
        {/* Header */}
        <div className='text-center mb-16 relative z-20'>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 1 }}
          >
            <span className='font-display text-sm font-bold tracking-[0.4em] uppercase text-orange-500/80 mb-4 block'>
              The Proposal
            </span>
            <h2 className='font-display text-5xl md:text-7xl text-cream-50 mb-6 drop-shadow-[0_0_25px_rgba(255,107,53,0.4)]'>
              {storyContent.title}
            </h2>

            <div className='flex items-center justify-center gap-4 text-orange-200/70 font-body tracking-widest text-sm uppercase'>
              <span className='text-xl animate-pulse'>🎃</span>
              <span>{storyContent.date}</span>
              <span className='text-xl animate-pulse'>🎃</span>
            </div>
          </motion.div>
        </div>

        {/* Content Layout - Fixed Grid */}
        <div className='relative max-w-6xl mx-auto mb-24'>
          {/* Glassmorphism Panel - Dark Spooky Variant (High Contrast Fix) */}
          <div className='bg-dark-950/80 backdrop-blur-2xl rounded-3xl p-8 md:p-14 border border-orange-500/30 shadow-[0_0_50px_-12px_rgba(0,0,0,0.8)] relative'>
            {/* Subtle Texture Overlay */}
            <div className='absolute inset-0 bg-[url("https://www.transparenttextures.com/patterns/stardust.png")] opacity-10 pointer-events-none rounded-3xl' />

            <div className='grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center relative z-10'>
              {/* Text Column */}
              <motion.div
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 1 }}
                className='relative order-2 lg:order-1'
              >
                <div className='relative z-10'>
                  <span className='absolute -top-16 -left-12 text-[10rem] font-display text-orange-500/20 leading-none select-none pointer-events-none'>
                    “
                  </span>
                  {storyContent.text.map((paragraph, index) => (
                    <p
                      key={index}
                      className='font-body text-lg md:text-xl leading-relaxed text-white mb-6 last:mb-0 relative z-10 drop-shadow-md font-normal'
                    >
                      {paragraph}
                    </p>
                  ))}
                </div>

                <motion.div
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.6 }}
                  className='mt-10 pt-8 border-t border-orange-500/30 flex items-center gap-4'
                >
                  <div className='h-px flex-1 bg-linear-to-r from-transparent via-orange-500/50 to-transparent opacity-50' />
                  <p className='font-display text-3xl text-orange-200 italic'>
                    {storyContent.finale}
                  </p>
                  <div className='h-px flex-1 bg-linear-to-r from-transparent via-orange-500/50 to-transparent opacity-50' />
                </motion.div>
              </motion.div>

              {/* Photo Column - Flex Staggered (No Absolute Positioning) */}
              <div className='flex flex-col items-center gap-8 md:gap-12 order-1 lg:order-2 py-8 lg:py-0'>
                {/* Secondary Photo - Top Right Tilted */}
                {secondaryPhoto && (
                  <motion.div
                    initial={{ opacity: 0, y: 30, rotate: -2 }}
                    whileInView={{ opacity: 1, y: 0, rotate: -6 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8 }}
                    className='w-full max-w-[320px] md:max-w-[380px] self-end lg:mr-8 hover:z-30 hover:scale-105 transition-all duration-500 will-change-transform'
                    style={{
                      filter: 'drop-shadow(0 20px 40px rgba(0,0,0,0.5))',
                    }}
                  >
                    <ProposalPolaroid
                      photo={secondaryPhoto}
                      onClick={() => setSelectedPhoto(secondaryPhoto)}
                    />
                  </motion.div>
                )}

                {/* Main Photo - Landscape Wide Photo */}
                {mainPhoto && (
                  <motion.div
                    initial={{ opacity: 0, y: 40, rotate: 2 }}
                    whileInView={{ opacity: 1, y: 0, rotate: 4 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8, delay: 0.2 }}
                    className='w-full max-w-[500px] md:max-w-[600px] self-start lg:ml-8 -mt-20 md:-mt-32 relative z-20 hover:z-30 hover:scale-105 transition-all duration-500 will-change-transform'
                    style={{
                      filter: 'drop-shadow(0 25px 50px rgba(0,0,0,0.6))',
                    }}
                  >
                    <ProposalPolaroid
                      photo={mainPhoto}
                      onClick={() => setSelectedPhoto(mainPhoto)}
                      aspectClass='aspect-video'
                    />
                  </motion.div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Gallery Grid */}
        <div className='relative z-10'>
          <div className='text-center mb-16 md:mb-24'>
            <span className='font-display text-sm font-bold tracking-[0.2em] uppercase text-orange-500/80 mb-2 block'>
              Gallery
            </span>
            <h3 className='font-display text-4xl lg:text-5xl text-cream-50 drop-shadow-md'>
              Capture the Fright
            </h3>
          </div>

          <EngagementGallery onPhotoSelect={setSelectedPhoto} />
        </div>
      </div>

      <EngagementModal selectedPhoto={selectedPhoto} onClose={() => setSelectedPhoto(null)} />

      {/* Spooky Audio Manager */}
      <HalloweenAudio isInView={isInView} />

      {/* Bottom Transition Connector */}
      <div className='absolute -bottom-12 left-1/2 -translate-x-1/2 w-px h-24 bg-linear-to-b from-orange-500 via-gold-300 to-gold-400/50 z-20' />

      {/* Divider */}
      <div className='absolute bottom-0 left-0 w-full overflow-hidden leading-0 z-10 translate-y-px'>
        <svg
          data-name='Layer 1'
          xmlns='http://www.w3.org/2000/svg'
          viewBox='0 0 1200 120'
          preserveAspectRatio='none'
          className='relative block w-[calc(100%+1.3px)] h-[60px]'
        >
          {/* Transition back to regular theme (likely cream) */}
          <path d='M1200 120L0 16.48 0 0 1200 0 1200 120z' className='fill-cream-50' />
        </svg>
      </div>
    </section>
  )
}

export default EngagementSection
