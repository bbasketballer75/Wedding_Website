import { useRef } from 'react'
import { motion, useScroll, useTransform, useSpring } from 'framer-motion'
import { Heart, MapPin, Calendar, Clapperboard, Play, Sparkles } from 'lucide-react'

import { cn } from '@/lib/utils'
import { LocationMap } from './LocationMap'
import { ImageCarousel } from './ImageCarousel'
import { TimelineIcon } from './TimelineIcon'
import { BridalShowerLink } from './BridalShowerLink'
import { Button } from '@/components/ui/Button'
import {
  MAIN_FILM_PROGRESS_KEY,
  formatVideoProgressLabel,
  readSavedVideoProgress,
} from '@/utils/videoProgress'


interface TimelineEvent {
  id: string
  date: string
  title: string
  description: string
  location?: string
  side: 'left' | 'right'
  media?: {
    type: 'map' | 'carousel' | 'icon' | 'link'
    config: Record<string, unknown>
  }
}

// Media paths configuration
const MEDIA_BASE_PATH = '/media/timeline'

// Timeline data with media
const timelineEvents: TimelineEvent[] = [
  {
    id: '1',
    date: 'Summer 2017',
    title: 'The Meeting',
    description: 'We met during a summer at work and somehow the ordinary days started feeling a lot less ordinary. It did not take long for us to realize something bigger was beginning.',
    side: 'left',
    media: {
      type: 'icon',
      config: { iconType: 'meeting' }
    }
  },
  {
    id: '2',
    date: 'Summer 2018',
    title: 'First Date',
    description: "This was the point where talking turned into choosing each other on purpose. It felt easy, exciting, and like the start of the version of life we actually wanted.",
    side: 'right',
    media: {
      type: 'icon',
      config: { iconType: 'first-date' }
    }
  },
  {
    id: '3',
    date: 'Summer 2019',
    title: 'Moved to Ligonier',
    description: 'We packed up, landed in Ligonier, and started building a life that finally felt like ours. New town, new routines, same certainty that we were doing it together.',
    location: 'Ligonier, PA',
    side: 'left',
    media: {
      type: 'map',
      config: { location: 'Ligonier, PA', type: 'town' }
    }
  },
  {
    id: '4',
    date: 'Fall 2020',
    title: 'Bought Our First Home',
    description: 'Keys in hand, we stepped into the first place that was truly ours. It was the beginning of quiet nights, shared projects, and all the little rituals that make a house feel like home.',
    side: 'right',
    media: {
      type: 'map',
      config: { location: 'Our First Home', type: 'home' }
    }
  },
  {
    id: '5',
    date: 'Nov 2020',
    title: 'The Kitties Arrive',
    description: 'Moira and Stella made the house feel instantly fuller, louder, and more us. Our little family grew by two and never looked back.',
    side: 'left',
    media: {
      type: 'carousel',
      config: {
        folder: 'cats',
        alt: 'Moira and Stella',
        count: 18
      }
    }
  },
  {
    id: '6',
    date: 'October 31, 2022',
    title: 'The Proposal 💍🎃',
    description: 'On Halloween night, in full costume and fully committed to the bit, Austin asked the question that changed everything. It was weird, perfect, emotional, and completely us.',
    location: 'Spookiest Night of the Year',
    side: 'right',
    media: {
      type: 'carousel',
      config: {
        folder: 'engagemnet',
        alt: 'Engagement Photos',
        count: 35
      }
    }
  },
  {
    id: '7',
    date: 'Aug 2024',
    title: 'Bachelor & Bachelorette',
    description: 'A full weekend in Pittsburgh with the people who know us best: loud laughs, late nights, and the kind of memories that only happen when everyone shows up big.',
    location: 'Pittsburgh, PA',
    side: 'left',
    media: {
      type: 'carousel',
      config: {
        folder: 'bachelor+ette',
        alt: 'Bachelor and Bachelorette Party',
        count: 7
      }
    }
  },
  {
    id: '8',
    date: 'Feb 2025',
    title: "Jordyn's Bridal Shower",
    description: 'One of those gentler celebrations we will always remember. It was full of love, stories, and the feeling that the wedding was finally close enough to touch.',
    location: 'The Boulevard Grill',
    side: 'right',
    media: {
      type: 'map',
      config: { location: 'The Boulevard Grill', type: 'town' }
    }
  },
  {
    id: '9',
    date: 'May 10, 2025',
    title: 'We Got Married!',
    description: 'The day all of these chapters finally met in one room. Surrounded by our people, we said yes again, this time out loud and for good.',
    location: 'The Lodge at Indian Lake',
    side: 'left',
    media: {
      type: 'icon',
      config: { iconType: 'wedding' }
    }
  }
]

// Actual image files by folder
const mediaFiles: Record<string, string[]> = {
  cats: [
    '643702797_1279521277363064_7267734551466470934_n~2.jpg',
    '20210128_150848~4.jpg',
    'PXL_20240114_184414874~2.jpg',
    '476362472_1084734026737475_962289537349129950_n~2.jpg',
    '608763682_1196135159331667_4161914504755009183_n.jpg',
    '640393213_1423751692681065_4616616824297509219_n~2.jpg',
    'PXL_20231220_151659126~2.jpg',
    'PXL_20230825_171945218.jpg'
  ],
  engagemnet: [
    'PoradaProposal-316.webp',
    'PoradaProposal-458.webp',
    'PoradaProposal-277.webp',
    'PoradaProposal-181.webp',
    'PoradaProposal-6.webp',
    'PoradaProposal-262.webp',
    'PoradaProposal-255.webp',
    'PoradaProposal-146.webp'
  ],
  'bachelor+ette': [
    '000108.jpg',
    '000407.jpg',
    '000191.jpg',
    '000429.jpg',
    '000198_2.jpg',
    '000106.jpg'
  ]
}

// Valid image extensions
const VALID_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif', '.bmp', '.svg']

// Helper to check if file is a valid image
function isValidImageFile(filename: string): boolean {
  const lowerName = filename.toLowerCase()
  return VALID_IMAGE_EXTENSIONS.some(ext => lowerName.endsWith(ext))
}

// Helper to generate image paths
function getImagePaths(folder: string, count: number): string[] {
  const files = mediaFiles[folder] || []
  // Filter for valid image files only
  const imageFiles = files.filter(isValidImageFile)
  return imageFiles.slice(0, Math.min(count, imageFiles.length)).map(file => 
    `${MEDIA_BASE_PATH}/${folder}/${file}`
  )
}

function HalloweenCard({ event, index }: { event: TimelineEvent; index: number }) {
  const cardRef = useRef<HTMLDivElement>(null)
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768

  const { scrollYProgress } = useScroll({
    target: cardRef,
    offset: ["start end", "center center"]
  })

  const opacity = useTransform(scrollYProgress, [0, 0.5, 1], [0.3, 1, 1])
  const scale = useTransform(scrollYProgress, [0, 0.5, 1], isMobile ? [0.97, 1, 1] : [0.8, 1, 1])
  const x = useTransform(scrollYProgress, [0, 1], isMobile ? [0, 0] : [event.side === 'left' ? -100 : 100, 0])

  // Get engagement photos
  const engagementImages = getImagePaths('engagemnet', 8)

  return (
    <motion.div
      ref={cardRef}
      style={{ opacity, scale, x }}
      className={cn(
        "relative z-[60] ml-7 w-[calc(100%-1.75rem)] md:ml-0 md:w-[calc(50%-60px)]",
        event.side === 'left' ? "md:mr-auto" : "md:ml-auto"
      )}
    >
      {/* Mobile timeline dot */}
      <div className="absolute -left-3 top-7 z-30 md:hidden">
        <div className="h-3 w-3 rounded-full border-2 border-white shadow-sm bg-red-600" />
      </div>

      {/* Horror Themed Halloween Card */}
      <motion.div
        whileHover={{ 
          y: -8,
          boxShadow: "0 38px 84px -18px rgba(72, 8, 31, 0.78), 0 0 90px rgba(251, 113, 133, 0.18)"
        }}
        transition={{ duration: 0.3 }}
        className="relative overflow-hidden rounded-[2rem] border-2 border-rose-950/80 bg-[linear-gradient(145deg,rgba(18,7,16,0.99),rgba(58,11,33,0.98)_34%,rgba(103,21,52,0.94)_65%,rgba(53,10,28,0.98)_100%)] p-6 shadow-2xl cursor-pointer group md:p-8"
      >
        {/* Animated Fog Layers */}
        <div className="absolute inset-0 pointer-events-none">
          <motion.div 
            animate={{ 
              opacity: [0.35, 0.7, 0.4],
              x: [-14, 12, -14]
            }}
            transition={{ duration: 8, repeat: Infinity }}
            className="absolute inset-0 bg-gradient-to-br from-rose-950/40 via-black to-red-950/25"
          />
          <motion.div
            animate={{ opacity: [0.18, 0.35, 0.2], rotate: [0, 3, -2, 0] }}
            transition={{ duration: 6.5, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute -left-16 top-8 h-64 w-56 bg-[radial-gradient(circle,rgba(251,191,36,0.34),rgba(251,113,133,0.12)_44%,transparent_72%)] blur-3xl"
          />
          <motion.div
            animate={{ opacity: [0.18, 0.42, 0.2], rotate: [0, -4, 2, 0] }}
            transition={{ duration: 7.2, repeat: Infinity, ease: 'easeInOut', delay: 1.2 }}
            className="absolute right-[-4rem] top-12 h-72 w-60 bg-[radial-gradient(circle,rgba(244,114,182,0.32),rgba(245,158,11,0.12)_48%,transparent_72%)] blur-3xl"
          />
          <div className="absolute inset-0 bg-[linear-gradient(130deg,transparent_16%,rgba(255,255,255,0.04)_31%,transparent_48%,rgba(255,181,90,0.06)_64%,transparent_81%)]" />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-red-950/10" />
        </div>

        <div className="pointer-events-none absolute inset-x-6 top-0 flex justify-between opacity-85">
          {[0, 1, 2, 3].map((index) => (
            <motion.div
              key={index}
              animate={{ height: [10, 18 + index * 4, 12], opacity: [0.7, 1, 0.75] }}
              transition={{ duration: 3.4 + index * 0.45, repeat: Infinity, delay: index * 0.35 }}
              className="w-1.5 rounded-b-full bg-gradient-to-b from-red-500 via-red-700 to-red-950 shadow-[0_0_12px_rgba(220,38,38,0.55)]"
            />
          ))}
        </div>

        {/* Cobweb - Top Right */}
        <svg className="absolute top-0 right-0 w-28 h-28 opacity-40" viewBox="0 0 100 100">
          <path d="M100,0 L100,100 M100,0 L0,0 M100,0 L50,50" stroke="#DC2626" strokeWidth="0.8" fill="none" opacity="0.6"/>
          <path d="M100,20 L70,20 M100,40 L80,40 M100,60 L90,60" stroke="#7F1D1D" strokeWidth="0.5" fill="none" opacity="0.4"/>
          <path d="M80,0 L80,30 M60,0 L60,20 M40,0 L40,15" stroke="#991B1B" strokeWidth="0.5" fill="none" opacity="0.3"/>
        </svg>

        {/* Cobweb - Bottom Left */}
        <svg className="absolute bottom-0 left-0 w-20 h-20 opacity-30 rotate-180" viewBox="0 0 100 100">
          <path d="M100,0 L100,100 M100,0 L0,0 M100,0 L50,50" stroke="#DC2626" strokeWidth="0.8" fill="none" opacity="0.5"/>
          <path d="M100,25 L75,25 M100,50 L85,50" stroke="#7F1D1D" strokeWidth="0.5" fill="none" opacity="0.3"/>
        </svg>

        {/* Shadow Silhouettes */}
        <motion.div
          animate={{ opacity: [0.15, 0.3, 0.14], x: [0, 8, 0], rotate: [0, 2, 0] }}
          transition={{ duration: 7, repeat: Infinity }}
          className="absolute right-6 top-6 text-5xl pointer-events-none select-none grayscale"
          style={{ filter: 'blur(1px) brightness(0.35)' }}
        >
          🧟
        </motion.div>
        <motion.div
          animate={{ opacity: [0.12, 0.22, 0.1], x: [0, -6, 0], rotate: [0, -4, 0] }}
          transition={{ duration: 6, repeat: Infinity, delay: 2 }}
          className="absolute bottom-10 left-4 text-4xl pointer-events-none select-none grayscale"
          style={{ filter: 'blur(1px) brightness(0.46)' }}
        >
          👰‍♀️
        </motion.div>
        <motion.div
          animate={{ opacity: [0.18, 0.4, 0.18], scale: [0.95, 1.06, 0.95], rotate: [0, 6, 0] }}
          transition={{ duration: 5.5, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute bottom-20 right-8 text-3xl pointer-events-none select-none"
        >
          🎃
        </motion.div>
        <motion.div
          animate={{ opacity: [0.2, 0.45, 0.2], y: [0, -6, 0] }}
          transition={{ duration: 4.8, repeat: Infinity, delay: 0.6 }}
          className="absolute left-10 top-10 text-2xl pointer-events-none select-none"
        >
          ✨
        </motion.div>

        {/* Flickering Light Effect */}
        <motion.div
          animate={{ opacity: [0.18, 0.38, 0.18, 0.46, 0.2] }}
          transition={{ duration: 2.5, repeat: Infinity, times: [0, 0.25, 0.5, 0.75, 1] }}
          className="absolute right-1/4 top-1/3 h-48 w-48 rounded-full bg-orange-700/20 blur-3xl pointer-events-none"
        />

        {/* Engagement Photos Carousel */}
        <div className="relative mb-5 overflow-hidden rounded-[1.65rem] border border-rose-300/25 bg-[linear-gradient(180deg,rgba(10,5,11,0.7),rgba(27,7,16,0.85))] p-3 shadow-[0_26px_45px_-26px_rgba(0,0,0,0.85)]">
          <motion.div
            animate={{ x: ['0%', '100%'] }}
            transition={{ duration: 4.5, repeat: Infinity, ease: 'linear' }}
            className="pointer-events-none absolute inset-y-0 left-[-20%] w-1/3 rotate-[18deg] bg-gradient-to-r from-transparent via-white/14 to-transparent blur-md"
          />
          <div className="pointer-events-none absolute inset-0 rounded-[1.25rem] border border-white/8 shadow-[inset_0_0_0_1px_rgba(251,113,133,0.12)]" />
          <ImageCarousel 
            images={engagementImages}
            alt="Engagement"
            autoPlayInterval={3500}
            className="h-[240px] rounded-[1.25rem] border border-rose-300/20 bg-black/70 md:h-[270px]"
          />
        </div>

        {/* Content */}
        <div className="relative z-10">
          {/* Date Badge */}
          <div className="flex items-center gap-2 mb-4">
            <span className="inline-flex items-center gap-2 border border-red-700/70 bg-[linear-gradient(135deg,rgba(94,10,22,0.86),rgba(54,7,17,0.82))] px-4 py-2 text-xs font-bold uppercase tracking-[0.25em] text-orange-100 shadow-[0_14px_24px_-16px_rgba(127,29,29,0.95)]">
              <Calendar className="w-3 h-3 text-orange-300" />
              {event.date}
            </span>
          </div>

          {/* Title */}
          <h3 className="mb-3 font-display text-[2.15rem] leading-none text-white md:text-[3rem]">
            <span className="text-rose-300 drop-shadow-[0_0_18px_rgba(244,114,182,0.72)]">The</span>
            <span className="ml-2 text-[#fff7eb] drop-shadow-[0_0_24px_rgba(255,247,235,0.12)]"> Proposal</span>
            <span className="ml-3 inline-block text-fuchsia-200 drop-shadow-[0_0_18px_rgba(244,114,182,0.65)]">💍</span>
          </h3>

          {/* Description */}
          <p className="mb-4 text-sm leading-relaxed text-[#f8e7ea] md:text-base">
            On All Hallows&apos; Eve, with the costumes on, the music up, and the whole night already
            feeling half haunted and half electric, Frankenstein finally asked his Bride the question
            that had been building toward forever.
          </p>
          
          <motion.p 
            animate={{ opacity: [1, 0.68, 1], textShadow: ['0 0 14px rgba(244,114,182,0.38)', '0 0 24px rgba(251,191,36,0.46)', '0 0 14px rgba(244,114,182,0.38)'] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="mb-4 font-display text-xl text-rose-300 drop-shadow-[0_0_14px_rgba(244,114,182,0.45)]"
          >
            She said yes, and the whole party tipped into forever.
          </motion.p>

          {/* Location */}
          <motion.div 
            className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-rose-100/88"
            whileHover={{ x: 5, color: '#f9a8d4' }}
          >
            <MapPin className="w-3 h-3 text-orange-300" />
            <span>Halloween night • costumes on • forever got weird in the best way</span>
          </motion.div>
        </div>

        {/* Vignette Effect */}
        <div className="absolute inset-0 pointer-events-none rounded-2xl shadow-[inset_0_0_60px_rgba(0,0,0,0.8)]" />
      </motion.div>

      {/* Timeline Dot - Halloween Theme */}
      <div className={cn(
        "absolute top-1/2 -translate-y-1/2 z-30 hidden md:flex",
        event.side === 'left' ? "-right-[68px]" : "-left-[68px]"
      )}>
        <motion.div
          initial={{ scale: 0 }}
          whileInView={{ scale: 1 }}
          viewport={{ once: true }}
          transition={{ delay: index * 0.1, type: "spring", stiffness: 200 }}
          whileHover={{ scale: 1.5 }}
          className="relative w-5 h-5 rounded-full border-4 shadow-lg cursor-pointer bg-red-600 border-red-400 shadow-red-600/60"
        >
          {/* Pulse Ring */}
          <motion.div
            animate={{ scale: [1, 2, 1], opacity: [0.5, 0, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="absolute inset-0 rounded-full -z-10 bg-red-500"
          />
        </motion.div>
      </div>

      {/* Connecting Line from Card to Center */}
      <div className={cn(
        "absolute top-1/2 -translate-y-1/2 h-0.5 bg-red-900/40 hidden md:block z-20",
        event.side === 'left' ? "-right-[60px] w-[60px]" : "-left-[60px] w-[60px]"
      )} />
    </motion.div>
  )
}

function TimelineCard({ event, index }: { event: TimelineEvent; index: number }) {
  const isHalloween = event.id === '6'
  
  // Use the special Halloween card for event #6
  if (isHalloween) {
    return <HalloweenCard event={event} index={index} />
  }

  return <StandardTimelineCard event={event} index={index} />
}

function StandardTimelineCard({ event, index }: { event: TimelineEvent; index: number }) {
  const cardRef = useRef<HTMLDivElement>(null)
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768

  const { scrollYProgress } = useScroll({
    target: cardRef,
    offset: ["start end", "center center"]
  })

  const opacity = useTransform(scrollYProgress, [0, 0.5, 1], [0.3, 1, 1])
  const scale = useTransform(scrollYProgress, [0, 0.5, 1], isMobile ? [0.97, 1, 1] : [0.8, 1, 1])
  const x = useTransform(
    scrollYProgress,
    [0, 1],
    isMobile ? [0, 0] : [event.side === 'left' ? -100 : 100, 0]
  )

  // Get images for carousel media
  const getCarouselImages = () => {
    if (event.media?.type !== 'carousel') return []
    const config = event.media.config as { folder: string; count: number }
    return getImagePaths(config.folder, config.count)
  }

  return (
    <motion.div
      ref={cardRef}
      style={{ opacity, scale, x }}
      className={cn(
        "relative z-[60] ml-7 w-[calc(100%-1.75rem)] md:ml-0 md:w-[calc(50%-60px)]",
        event.side === 'left' ? "md:mr-auto" : "md:ml-auto"
      )}
    >
      {/* Mobile timeline dot */}
      <div className="absolute -left-3 top-7 z-30 md:hidden">
        <div className={cn(
          "h-3 w-3 rounded-full border-2 border-white shadow-sm",
          event.date === 'May 10, 2025' ? "bg-rose-500" : "bg-gold-500"
        )} />
      </div>

      {/* Standard Card */}
      <motion.div
        whileHover={{ 
          y: -8, 
          boxShadow: "0 25px 50px -12px rgba(198, 156, 78, 0.35)",
          borderColor: "rgba(198, 156, 78, 0.6)"
        }}
        transition={{ duration: 0.3 }}
        className="relative bg-white rounded-2xl p-6 md:p-8 border border-gold-200/80 cursor-pointer group shadow-lg hover:shadow-xl hover:border-gold-300 transition-all duration-300"
      >
        {/* Animated Background Gradient */}
        <motion.div 
          className="absolute inset-0 bg-gradient-to-br from-gold-50/80 via-transparent to-rose-50/80 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        />

        {/* Floating Particles on Hover */}
        <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <motion.div
            animate={{ y: [0, -10, 0], opacity: [0, 1, 0] }}
            transition={{ repeat: Infinity, duration: 2 }}
          >
            <Sparkles className="w-4 h-4 text-gold-400" />
          </motion.div>
        </div>

        {/* Media Section */}
        {event.media && (
          <div className="mb-6">
            {event.media.type === 'map' && (
              <LocationMap 
                location={(event.media.config as { location: string }).location}
                type={(event.media.config as { type: 'town' | 'home' }).type}
              />
            )}
            {event.media.type === 'carousel' && (
              <ImageCarousel 
                images={getCarouselImages()}
                alt={(event.media.config as { alt: string }).alt}
                autoPlayInterval={3000}
              />
            )}
            {event.media.type === 'icon' && (
              <TimelineIcon 
                type={(event.media.config as { iconType: 'meeting' | 'first-date' | 'wedding' | 'generic' }).iconType} 
              />
            )}
            {event.media.type === 'link' && <BridalShowerLink />}
          </div>
        )}

        {/* Content */}
        <div className="relative z-10">
          {/* Date Badge */}
          <motion.div 
            className="flex items-center gap-2 mb-4"
            whileHover={{ scale: 1.05 }}
          >
            <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-gold-100 text-gold-700 text-xs font-semibold tracking-wide">
              <Calendar className="w-3 h-3" />
              {event.date}
            </span>
          </motion.div>

          {/* Title */}
          <h3 className="font-display text-2xl md:text-3xl text-charcoal-900 mb-3 group-hover:text-gold-600 transition-colors duration-300">
            {event.title}
          </h3>

          {/* Description */}
          <p className="text-charcoal-600 text-sm md:text-base leading-relaxed mb-4">
            {event.description}
          </p>

          {/* Location */}
          {event.location && (
            <motion.div 
              className="flex items-center gap-1.5 text-gold-600 text-xs font-medium"
              whileHover={{ x: 5 }}
            >
              <MapPin className="w-3 h-3" />
              <span>{event.location}</span>
            </motion.div>
          )}
        </div>
      </motion.div>

      {/* Timeline Dot - Properly Aligned to Center */}
      <div className={cn(
        "absolute top-1/2 -translate-y-1/2 z-30 hidden md:flex",
        event.side === 'left' ? "-right-[68px]" : "-left-[68px]"
      )}>
        <motion.div
          initial={{ scale: 0 }}
          whileInView={{ scale: 1 }}
          viewport={{ once: true }}
          transition={{ delay: index * 0.1, type: "spring", stiffness: 200 }}
          whileHover={{ scale: 1.5 }}
          className={cn(
            "relative w-5 h-5 rounded-full border-4 shadow-lg cursor-pointer transition-colors duration-300",
            event.date === 'May 10, 2025' 
              ? "bg-rose-500 border-white shadow-rose-300/50" 
              : "bg-gold-500 border-white shadow-gold-300/50"
          )}
        >
          {/* Pulse Ring */}
          <motion.div
            animate={{ scale: [1, 2, 1], opacity: [0.5, 0, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
            className={cn(
              "absolute inset-0 rounded-full -z-10",
              event.date === 'May 10, 2025' ? "bg-rose-400" : "bg-gold-400"
            )}
          />
        </motion.div>
      </div>

      {/* Connecting Line from Card to Center */}
      <div className={cn(
        "absolute top-1/2 -translate-y-1/2 h-0.5 bg-gold-300/50 hidden md:block z-20",
        event.side === 'left' ? "-right-[60px] w-[60px]" : "-left-[60px] w-[60px]"
      )} />
    </motion.div>
  )
}

function FilmCTACard() {
  const cardRef = useRef<HTMLDivElement>(null)
  const resumeTime = readSavedVideoProgress(MAIN_FILM_PROGRESS_KEY)

  const { scrollYProgress } = useScroll({
    target: cardRef,
    offset: ['start end', 'center center'],
  })

  const opacity = useTransform(scrollYProgress, [0, 0.5, 1], [0.3, 1, 1])
  const scale = useTransform(scrollYProgress, [0, 0.5, 1], [0.95, 1, 1])

  return (
    <motion.div
      ref={cardRef}
      style={{ opacity, scale }}
      className="relative z-[60] ml-7 w-[calc(100%-1.75rem)] md:mx-auto md:ml-0 md:w-full md:max-w-xl"
    >
      {/* Mobile dot — left rail */}
      <div className="absolute -left-3 top-8 z-30 md:hidden">
        <div className="h-3 w-3 rounded-full border-2 border-white bg-gold-500 shadow-sm" />
      </div>

      {/* Desktop dot — top-center, rail terminates here */}
      <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-30 hidden md:block">
        <motion.div
          initial={{ scale: 0 }}
          whileInView={{ scale: 1 }}
          viewport={{ once: true }}
          transition={{ type: 'spring', stiffness: 200 }}
          className="relative h-5 w-5 rounded-full border-4 border-white bg-gold-500 shadow-lg shadow-gold-300/50"
        >
          <motion.div
            animate={{ scale: [1, 2.2, 1], opacity: [0.5, 0, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="absolute inset-0 rounded-full -z-10 bg-gold-400"
          />
        </motion.div>
      </div>

      {/* Card */}
      <motion.div
        whileHover={{ y: -6, boxShadow: '0 30px 60px -15px rgba(198,156,78,0.3)', borderColor: 'rgba(198,156,78,0.6)' }}
        transition={{ duration: 0.3 }}
        className="relative overflow-hidden rounded-2xl border border-gold-200/80 bg-white p-6 shadow-lg cursor-pointer group sm:p-8"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-gold-200/60 bg-gold-50 text-gold-600">
            <Clapperboard className="h-5 w-5" />
          </div>
          <motion.div
            animate={{ scale: [1, 1.12, 1] }}
            transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gold-300/50 bg-gold-50 text-gold-600"
          >
            <Play className="h-4 w-4 fill-gold-500 text-gold-500 ml-0.5" />
          </motion.div>
        </div>

        <h3 className="mt-5 font-display text-2xl text-charcoal-900 transition-colors duration-300 group-hover:text-gold-600 sm:text-3xl">
          The whole night, start to finish.
        </h3>

        <p className="mt-3 text-sm leading-relaxed text-charcoal-600 sm:text-base">
          Ceremony, vows, speeches, first dance — and everything in between.
        </p>

        <div className="mt-6">
          <Button size="lg" to={resumeTime ? `/film?resume=1` : '/film'} className="w-full justify-center">
            {resumeTime ? `Resume at ${formatVideoProgressLabel(resumeTime)}` : 'Watch the Film'}
          </Button>
        </div>

        <motion.div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-gold-50/60 via-transparent to-rose-50/60 opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
      </motion.div>
    </motion.div>
  )
}

export function LoveTimeline() {
  const containerRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"]
  })

  // Smooth progress animation
  const smoothProgress = useSpring(scrollYProgress, { 
    stiffness: 50, 
    damping: 20 
  })
  
  // Line height grows with scroll
  const lineHeight = useTransform(smoothProgress, [0, 0.8], ["0%", "100%"])
  
  // Parallax background elements
  const bgY = useTransform(scrollYProgress, [0, 1], [0, -100])
  
  // Progress indicator position
  const progressY = useTransform(lineHeight, (v) => v)

  return (
    <section id="love-timeline" ref={containerRef} className="relative py-24 px-4 bg-gradient-to-b from-cream-50 via-gold-50/30 to-cream-100 overflow-hidden">
      {/* Animated Background Elements */}
      <motion.div 
        style={{ y: bgY }}
        className="absolute inset-0 pointer-events-none"
      >
        {/* Floating Hearts */}
        {[...Array(5)].map((_, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 100 }}
            animate={{ 
              opacity: [0.1, 0.3, 0.1], 
              y: [-20, -40, -20],
              rotate: [0, 10, -10, 0]
            }}
            transition={{ 
              duration: 4 + i, 
              repeat: Infinity,
              delay: i * 0.5
            }}
            className="absolute text-gold-200/30"
            style={{
              left: `${15 + i * 20}%`,
              top: `${20 + i * 15}%`,
            }}
          >
            <Heart className="w-8 h-8 fill-current" />
          </motion.div>
        ))}
      </motion.div>

      <div className="max-w-5xl mx-auto relative">
        {/* Header with Scroll Animation */}
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="text-center mb-20"
        >
          <motion.div 
            initial={{ scale: 0 }}
            whileInView={{ scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2, type: "spring" }}
            className="flex items-center justify-center gap-3 mb-4"
          >
            <Heart className="w-5 h-5 text-rose-400 fill-rose-400" />
            <span className="text-gold-600 text-xs uppercase tracking-[0.4em] font-medium">
              Our Love Story
            </span>
            <Heart className="w-5 h-5 text-rose-400 fill-rose-400" />
          </motion.div>
          
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
            className="font-display text-4xl md:text-6xl text-charcoal-900 mb-4"
          >
            The Journey to I Do
          </motion.h2>
          
          <motion.p 
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4 }}
            className="text-charcoal-500 text-sm max-w-lg mx-auto"
          >
            From a summer job to forever. Here&apos;s how our story unfolded.
          </motion.p>
        </motion.div>

        {/* Timeline Container */}
        <div className="relative z-10">
          {/* Background Line - Behind cards */}
          <div className="absolute left-4 md:left-1/2 top-0 bottom-0 w-1 bg-gold-200/30 md:-translate-x-1/2 rounded-full z-0" />
          
          {/* Animated Progress Line - Behind cards */}
          <motion.div 
            style={{ height: lineHeight }}
            className="absolute left-4 md:left-1/2 top-0 w-1 bg-gradient-to-b from-gold-400 via-gold-500 to-rose-400 md:-translate-x-1/2 rounded-full origin-top z-0"
          />

          {/* Progress Indicator - Above cards */}
          <motion.div
            style={{ top: progressY }}
            className="absolute left-4 md:left-1/2 -translate-x-1/2 z-[70] hidden md:block"
          >
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="w-6 h-6 bg-white rounded-full shadow-lg border-4 border-gold-500 flex items-center justify-center"
            >
              <Heart className="w-2.5 h-2.5 text-rose-500 fill-rose-500" />
            </motion.div>
          </motion.div>

          {/* Mobile Progress Dot */}
          <motion.div
            style={{ top: progressY }}
            className="absolute left-4 -translate-x-1.5 z-[70] md:hidden"
          >
            <div className="w-4 h-4 bg-gold-500 rounded-full border-2 border-white shadow-md" />
          </motion.div>

          {/* Events - Above timeline elements */}
          <div className="relative z-10 space-y-16 md:space-y-24 pb-12">
            {timelineEvents.map((event, index) => (
              <TimelineCard key={event.id} event={event} index={index} />
            ))}
            <FilmCTACard />
          </div>
        </div>
      </div>
    </section>
  )
}
