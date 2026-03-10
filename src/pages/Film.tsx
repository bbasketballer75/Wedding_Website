import { motion } from 'framer-motion'
import { VideoPlayer } from '@/components/video/VideoPlayer'
import { Button } from '@/components/ui/Button'
import { FamilyTree } from '@/components/family-tree/FamilyTree'
import { getMediaPath } from '@/utils/media'
import { Play, Clock, Calendar, MapPin, ArrowDown } from 'lucide-react'

// Chapter data for the wedding film
const chapters = [
  { label: 'Getting Ready', time: 0 },
  { label: 'First Look', time: 300 },
  { label: 'The Ceremony', time: 900 },
  { label: 'Cocktail Hour', time: 1800 },
  { label: 'Reception', time: 2400 },
  { label: 'First Dance', time: 3000 },
  { label: 'Dancing', time: 3600 },
  { label: 'Send Off', time: 4200 },
]

// Family films data
const familyFilms = [
  { id: 'mom', label: "A Message from Mom", duration: '5:32', thumbnail: '/images/parents/heather.webp' },
  { id: 'christine', label: "Christine's Toast", duration: '8:15', thumbnail: '/images/parents/christine.webp' },
  { id: 'jerame', label: "Jerame's Words", duration: '6:45', thumbnail: '/images/parents/jerame.webp' },
  { id: 'melony', label: "Melony's Message", duration: '7:20', thumbnail: '/images/parents/melony.webp' },
]

export default function Film() {
  const scrollToVideo = () => {
    document.getElementById('wedding-video')?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div className="min-h-screen bg-cream-50">
      {/* Header Section */}
      <section className="pt-32 pb-12 px-4">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="text-center"
          >
            <span className="text-gold-600 text-sm uppercase tracking-[0.3em] font-medium">
              Our Wedding Film
            </span>
            <h1 className="font-display text-5xl md:text-7xl text-charcoal-900 mt-4 mb-6">
              May 10, 2025
            </h1>
            
            <div className="flex flex-wrap items-center justify-center gap-6 text-charcoal-600">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gold-500" />
                <span className="text-sm">Saturday, May 10th</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-gold-500" />
                <span className="text-sm">The Lodge at Indian Lake</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-gold-500" />
                <span className="text-sm">42 Minutes</span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Family Tree Section */}
      <section className="py-16 px-4 bg-white">
        <FamilyTree />
        
        {/* Scroll to Video Button */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
          className="flex justify-center mt-8"
        >
          <button
            onClick={scrollToVideo}
            className="flex flex-col items-center gap-2 text-charcoal-400 hover:text-gold-500 transition-colors"
          >
            <span className="text-xs uppercase tracking-widest">Watch the Film</span>
            <motion.div
              animate={{ y: [0, 5, 0] }}
              transition={{ repeat: Infinity, duration: 1.5 }}
            >
              <ArrowDown className="w-5 h-5" />
            </motion.div>
          </button>
        </motion.div>
      </section>

      {/* Main Video Player */}
      <section id="wedding-video" className="px-4 py-16">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            <VideoPlayer
              src={getMediaPath('/video/main.mp4')}
              title="Austin & Jordyn's Wedding"
              chapters={chapters}
              poster="/images/engagement/PoradaProposal-29.webp"
              className="aspect-video shadow-dramatic"
            />
          </motion.div>

          {/* Chapter Quick Links */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mt-8"
          >
            <h3 className="text-sm uppercase tracking-[0.2em] text-charcoal-500 mb-4">
              Jump to a Moment
            </h3>
            <div className="flex flex-wrap gap-2">
              {chapters.map((chapter) => (
                <button
                  key={chapter.label}
                  className="px-4 py-2 rounded-full bg-white border border-gold-200/60 text-sm text-charcoal-700 hover:border-gold-500 hover:bg-gold-50/50 transition-all"
                >
                  {chapter.label}
                </button>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Family Films Section */}
      <section className="py-16 px-4 bg-cream-100">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-12"
          >
            <h2 className="font-display text-4xl md:text-5xl text-charcoal-900 mb-4">
              Family Messages
            </h2>
            <p className="text-charcoal-600 max-w-2xl mx-auto">
              Special messages from our parents sharing their love and wisdom
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {familyFilms.map((film, i) => (
              <motion.div
                key={film.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="group cursor-pointer"
              >
                <div className="relative aspect-[3/4] rounded-xl overflow-hidden bg-charcoal-200 mb-3">
                  {/* Placeholder for thumbnail */}
                  <div className="absolute inset-0 bg-gradient-to-br from-charcoal-300 to-charcoal-400" />
                  
                  {/* Play Button Overlay */}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/40 transition-colors">
                    <div className="w-14 h-14 rounded-full bg-white/90 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                      <Play className="w-6 h-6 text-charcoal-800 ml-1" fill="currentColor" />
                    </div>
                  </div>

                  {/* Duration Badge */}
                  <div className="absolute bottom-3 right-3 px-2 py-1 bg-black/60 rounded text-white text-xs font-mono">
                    {film.duration}
                  </div>
                </div>

                <h3 className="font-display text-lg text-charcoal-800 group-hover:text-gold-600 transition-colors">
                  {film.label}
                </h3>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Call to Action */}
      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="font-display text-3xl md:text-4xl text-charcoal-900 mb-4">
              Have Photos or Videos From Our Day?
            </h2>
            <p className="text-charcoal-600 mb-8 max-w-xl mx-auto">
              We'd love to see your perspective! Share your photos and videos to help us complete the story.
            </p>
            <Button size="lg" to="/upload">
              Share Your Memories
            </Button>
          </motion.div>
        </div>
      </section>
    </div>
  )
}
