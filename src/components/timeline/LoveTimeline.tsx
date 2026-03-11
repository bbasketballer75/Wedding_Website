import { useRef } from 'react'
import { motion, useScroll, useTransform, useSpring } from 'framer-motion'
import { Heart, MapPin, Calendar, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { LocationMap } from './LocationMap'
import { ImageCarousel } from './ImageCarousel'
import { TimelineIcon } from './TimelineIcon'
import { BridalShowerLink } from './BridalShowerLink'
import { getMediaPath } from '@/utils/media'

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
const MEDIA_BASE_PATH = getMediaPath('/media/timeline')

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
  
  const { scrollYProgress } = useScroll({
    target: cardRef,
    offset: ["start end", "center center"]
  })
  
  const opacity = useTransform(scrollYProgress, [0, 0.5, 1], [0.3, 1, 1])
  const scale = useTransform(scrollYProgress, [0, 0.5, 1], [0.8, 1, 1])
  const x = useTransform(scrollYProgress, [0, 1], [event.side === 'left' ? -100 : 100, 0])

  // Get engagement photos
  const engagementImages = getImagePaths('engagemnet', 8)

  return (
    <motion.div
      ref={cardRef}
      style={{ opacity, scale, x }}
      className={cn(
        "relative z-[60] w-full md:w-[calc(50%-60px)]",
        event.side === 'left' ? "md:mr-auto" : "md:ml-auto"
      )}
    >
      {/* Horror Themed Halloween Card */}
      <motion.div
        whileHover={{ 
          y: -8,
          boxShadow: "0 34px 72px -18px rgba(85, 11, 24, 0.58), 0 0 60px rgba(244, 114, 182, 0.16)"
        }}
        transition={{ duration: 0.3 }}
        className="relative overflow-hidden rounded-[2rem] border-2 border-red-950/65 bg-[linear-gradient(145deg,rgba(19,8,15,0.98),rgba(47,14,26,0.96)_42%,rgba(89,22,40,0.92)_100%)] p-6 shadow-2xl cursor-pointer group md:p-8"
      >
        {/* Animated Fog Layers */}
        <div className="absolute inset-0 pointer-events-none">
          <motion.div 
            animate={{ 
              opacity: [0.4, 0.7, 0.4],
              x: [-10, 10, -10]
            }}
            transition={{ duration: 8, repeat: Infinity }}
            className="absolute inset-0 bg-gradient-to-br from-rose-950/35 via-black to-red-950/25"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-red-950/10" />
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

        {/* Blood Drips - Top Edge */}
        <div className="absolute top-0 left-4 right-4 flex justify-around opacity-60">
          {[12, 35, 55, 78].map((left, i) => (
            <motion.div
              key={i}
              initial={{ height: 8 }}
              animate={{ height: [8, 18 + i * 3, 10, 22, 12] }}
              transition={{ duration: 4 + i, repeat: Infinity, delay: i * 0.4 }}
              className="w-1.5 bg-gradient-to-b from-red-700 via-red-900 to-red-950 rounded-b-full"
              style={{ position: 'absolute', left: `${left}%` }}
            />
          ))}
        </div>

        {/* Shadow Silhouettes */}
        <motion.div
          animate={{ opacity: [0.15, 0.25, 0.15], x: [0, 8, 0] }}
          transition={{ duration: 7, repeat: Infinity }}
          className="absolute top-6 right-6 text-5xl pointer-events-none select-none grayscale"
          style={{ filter: 'blur(1px) brightness(0.3)' }}
        >
          🧟
        </motion.div>
        <motion.div
          animate={{ opacity: [0.12, 0.2, 0.12], x: [0, -5, 0] }}
          transition={{ duration: 6, repeat: Infinity, delay: 2 }}
          className="absolute bottom-10 left-4 text-4xl pointer-events-none select-none grayscale"
          style={{ filter: 'blur(1px) brightness(0.4)' }}
        >
          👰‍♀️
        </motion.div>

        {/* Flickering Light Effect */}
        <motion.div
          animate={{ opacity: [0.2, 0.35, 0.2, 0.4, 0.2] }}
          transition={{ duration: 2.5, repeat: Infinity, times: [0, 0.25, 0.5, 0.75, 1] }}
          className="absolute top-1/3 right-1/4 w-48 h-48 bg-orange-700/20 rounded-full blur-3xl pointer-events-none"
        />

        {/* Engagement Photos Carousel */}
        <div className="mb-4">
          <ImageCarousel 
            images={engagementImages}
            alt="Engagement"
            autoPlayInterval={3500}
          />
        </div>

        {/* Content */}
        <div className="relative z-10">
          {/* Date Badge */}
          <div className="flex items-center gap-2 mb-4">
            <span className="inline-flex items-center gap-2 px-4 py-2 bg-red-950/80 text-red-400 text-xs font-bold tracking-widest border border-red-800/60 uppercase shadow-lg">
              <Calendar className="w-3 h-3 text-red-500" />
              {event.date}
            </span>
          </div>

          {/* Title */}
          <h3 className="mb-3 font-display text-2xl text-white md:text-3xl">
            <span className="text-rose-400 drop-shadow-[0_0_12px_rgba(244,114,182,0.55)]">The</span>
            <span className="text-[#fff7eb]"> Proposal</span>
            <span className="ml-2 inline-block text-red-700 drop-shadow-lg">💍</span>
          </h3>

          {/* Description */}
          <p className="mb-4 text-sm leading-relaxed text-[#f6e7ea] md:text-base">
            On All Hallows&apos; Eve, with the costumes committed and the whole night already feeling cinematic,
            Frankenstein finally asked his Bride the question that had been building toward forever.
            It was eerie, funny, romantic, and somehow even sweeter because it happened in the most us way possible.
          </p>
          
          <motion.p 
            animate={{ opacity: [1, 0.6, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="mb-4 font-display text-xl text-rose-400 drop-shadow-[0_0_14px_rgba(244,114,182,0.45)]"
          >
            She said yes, and the whole season changed.
          </motion.p>

          {/* Location */}
          <motion.div 
            className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-rose-200/88"
            whileHover={{ x: 5, color: '#f9a8d4' }}
          >
            <MapPin className="w-3 h-3" />
            <span>Halloween Night • Forever got spooky</span>
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

  const { scrollYProgress } = useScroll({
    target: cardRef,
    offset: ["start end", "center center"]
  })

  const opacity = useTransform(scrollYProgress, [0, 0.5, 1], [0.3, 1, 1])
  const scale = useTransform(scrollYProgress, [0, 0.5, 1], [0.8, 1, 1])
  const x = useTransform(
    scrollYProgress, 
    [0, 1], 
    [event.side === 'left' ? -100 : 100, 0]
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
        "relative z-[60] w-full md:w-[calc(50%-60px)]",
        event.side === 'left' ? "md:mr-auto" : "md:ml-auto"
      )}
    >
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
    <section ref={containerRef} className="relative py-24 px-4 bg-gradient-to-b from-cream-50 via-gold-50/30 to-cream-100 overflow-hidden">
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
          </div>
        </div>

        {/* Bottom CTA - Link to Film */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mt-24 pt-12"
        >
          <motion.a
            href="/film"
            whileHover={{ scale: 1.05, y: -3 }}
            whileTap={{ scale: 0.98 }}
            className="inline-flex items-center gap-3 bg-gradient-to-r from-gold-100 to-gold-50 rounded-full px-8 py-4 shadow-soft border border-gold-200 hover:shadow-gold hover:border-gold-300 transition-all cursor-pointer group"
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
              className="group-hover:scale-110 transition-transform"
            >
              <Sparkles className="w-5 h-5 text-gold-500" />
            </motion.div>
            <span className="text-charcoal-800 text-sm font-medium group-hover:text-gold-700 transition-colors">
              Watch Our Wedding Film
            </span>
          </motion.a>
        </motion.div>
      </div>
    </section>
  )
}
