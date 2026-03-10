import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Avatar } from '@/components/ui/Avatar'
import { Heart, Users, Crown, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Person {
  id: string
  name: string
  role: string
  side?: 'bride' | 'groom'
  image?: string
}

interface FamilyNode {
  couple: Person[]
  parents: {
    bride: Person[]
    groom: Person[]
  }
  weddingParty: {
    bridesmaids: Person[]
    groomsmen: Person[]
  }
}

const familyData: FamilyNode = {
  couple: [
    { id: 'jordyn', name: 'Jordyn', role: 'The Bride', side: 'bride' },
    { id: 'austin', name: 'Austin', role: 'The Groom', side: 'groom' },
  ],
  parents: {
    bride: [
      { id: 'mom-b', name: 'Christine', role: 'Mother of the Bride', side: 'bride' },
      { id: 'dad-b', name: 'Jerame', role: 'Father of the Bride', side: 'bride' },
    ],
    groom: [
      { id: 'mom-g', name: 'Melony', role: 'Mother of the Groom', side: 'groom' },
      { id: 'dad-g', name: 'David', role: 'Father of the Groom', side: 'groom' },
    ],
  },
  weddingParty: {
    bridesmaids: [
      { id: 'bm1', name: 'Maid of Honor', role: 'Best Friend', side: 'bride' },
      { id: 'bm2', name: 'Bridesmaid', role: 'Sister', side: 'bride' },
      { id: 'bm3', name: 'Bridesmaid', role: 'Cousin', side: 'bride' },
    ],
    groomsmen: [
      { id: 'gm1', name: 'Best Man', role: 'Brother', side: 'groom' },
      { id: 'gm2', name: 'Groomsman', role: 'College Friend', side: 'groom' },
      { id: 'gm3', name: 'Groomsman', role: 'Childhood Friend', side: 'groom' },
    ],
  },
}

function PersonCard({ person, isCenter = false, onClick, isSelected }: { 
  person: Person
  isCenter?: boolean
  onClick?: () => void
  isSelected?: boolean
}) {
  const isBride = person.side === 'bride'
  
  return (
    <motion.div
      layout
      onClick={onClick}
      className={cn(
        "relative cursor-pointer group",
        isCenter ? "scale-110" : "hover:scale-105"
      )}
      whileHover={{ y: -5 }}
      whileTap={{ scale: 0.95 }}
    >
      {/* Glow Effect */}
      <div className={cn(
        "absolute inset-0 rounded-full blur-xl opacity-0 group-hover:opacity-40 transition-opacity duration-500",
        isBride ? "bg-rose-400" : "bg-blue-400"
      )} />
      
      {/* Card */}
      <div className={cn(
        "relative flex flex-col items-center p-4 rounded-2xl transition-all duration-300",
        isCenter 
          ? "bg-gradient-to-br from-gold-100 to-gold-200 shadow-lg" 
          : "bg-white/90 backdrop-blur-sm shadow-soft hover:shadow-medium",
        isSelected && "ring-2 ring-gold-400"
      )}>
        {/* Avatar */}
        <div className="relative">
          <Avatar 
            fallback={person.name} 
            size={isCenter ? "xl" : "lg"}
            className={cn(
              "border-2",
              isBride ? "border-rose-300" : "border-blue-300",
              isCenter && "border-gold-400"
            )}
          />
          
          {/* Side Indicator */}
          <div className={cn(
            "absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px]",
            isBride ? "bg-rose-400 text-white" : "bg-blue-400 text-white"
          )}>
            {isBride ? '♀' : '♂'}
          </div>
        </div>
        
        {/* Info */}
        <div className="mt-3 text-center">
          <p className={cn(
            "font-display font-medium",
            isCenter ? "text-lg text-charcoal-900" : "text-sm text-charcoal-800"
          )}>
            {person.name}
          </p>
          <p className="text-xs text-charcoal-500 mt-0.5">{person.role}</p>
        </div>
        
        {/* Sparkle for center */}
        {isCenter && (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            className="absolute -top-2 -right-2 text-gold-500"
          >
            <Sparkles className="w-4 h-4" />
          </motion.div>
        )}
      </div>
    </motion.div>
  )
}

function ConnectionLine({ vertical = false, animated = false }: { vertical?: boolean; animated?: boolean }) {
  return (
    <div className={cn(
      "relative overflow-hidden",
      vertical ? "w-px h-8 my-2" : "h-px w-16 mx-2"
    )}>
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-gold-300 to-transparent" />
      {animated && (
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-gold-500 to-transparent"
          animate={{ x: vertical ? 0 : ["-100%", "100%"], y: vertical ? ["-100%", "100%"] : 0 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        />
      )}
    </div>
  )
}

export function FamilyTree() {
  const [selectedPerson, setSelectedPerson] = useState<string | null>(null)
  const [hoveredSection, setHoveredSection] = useState<string | null>(null)

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-12">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-16"
      >
        <div className="flex items-center justify-center gap-2 mb-3">
          <Users className="w-4 h-4 text-gold-500" />
          <span className="text-gold-600 text-xs uppercase tracking-[0.3em] font-medium">
            Meet the Wedding Party
          </span>
        </div>
        <h2 className="font-display text-3xl md:text-4xl text-charcoal-900">
          Our Family & Friends
        </h2>
        <p className="text-charcoal-500 mt-2 text-sm max-w-lg mx-auto">
          Click on anyone to learn more about their role in our special day
        </p>
      </motion.div>

      {/* Tree Container */}
      <div className="relative">
        {/* Parents Row */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex justify-center items-start gap-8 md:gap-24 mb-4"
        >
          {/* Bride's Parents */}
          <div 
            className="flex flex-col items-center"
            onMouseEnter={() => setHoveredSection('bride-parents')}
            onMouseLeave={() => setHoveredSection(null)}
          >
            <p className="text-xs text-rose-500 uppercase tracking-wider mb-3">Bride&apos;s Family</p>
            <div className="flex items-center gap-4">
              {familyData.parents.bride.map((parent, i) => (
                <motion.div
                  key={parent.id}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.3 + i * 0.1 }}
                >
                  <PersonCard 
                    person={parent} 
                    onClick={() => setSelectedPerson(parent.id)}
                    isSelected={selectedPerson === parent.id}
                  />
                </motion.div>
              ))}
            </div>
            <ConnectionLine vertical animated={hoveredSection === 'bride-parents'} />
          </div>

          {/* Groom's Parents */}
          <div 
            className="flex flex-col items-center"
            onMouseEnter={() => setHoveredSection('groom-parents')}
            onMouseLeave={() => setHoveredSection(null)}
          >
            <p className="text-xs text-blue-500 uppercase tracking-wider mb-3">Groom&apos;s Family</p>
            <div className="flex items-center gap-4">
              {familyData.parents.groom.map((parent, i) => (
                <motion.div
                  key={parent.id}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.3 + i * 0.1 }}
                >
                  <PersonCard 
                    person={parent} 
                    onClick={() => setSelectedPerson(parent.id)}
                    isSelected={selectedPerson === parent.id}
                  />
                </motion.div>
              ))}
            </div>
            <ConnectionLine vertical animated={hoveredSection === 'groom-parents'} />
          </div>
        </motion.div>

        {/* The Couple - Center */}
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5, type: "spring" }}
          className="flex justify-center items-center gap-6 mb-8"
        >
          {/* Connection from parents */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-px h-8 bg-gradient-to-b from-gold-300 to-transparent" />
          
          {familyData.couple.map((person, i) => (
            <motion.div
              key={person.id}
              initial={{ opacity: 0, x: i === 0 ? -20 : 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.6 + i * 0.1 }}
              className="relative"
            >
              <PersonCard 
                person={person} 
                isCenter
                onClick={() => setSelectedPerson(person.id)}
                isSelected={selectedPerson === person.id}
              />
              
              {/* Heart between couple */}
              {i === 0 && (
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="absolute top-1/2 -right-9 -translate-y-1/2 z-10"
                >
                  <Heart className="w-5 h-5 text-rose-400 fill-rose-400" />
                </motion.div>
              )}
            </motion.div>
          ))}
        </motion.div>

        {/* Crown decoration */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="flex justify-center mb-4"
        >
          <Crown className="w-6 h-6 text-gold-400" />
        </motion.div>

        {/* Wedding Party Row */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="flex justify-center items-start gap-8 md:gap-16"
        >
          {/* Bridesmaids */}
          <div 
            className="flex flex-col items-center"
            onMouseEnter={() => setHoveredSection('bridesmaids')}
            onMouseLeave={() => setHoveredSection(null)}
          >
            <ConnectionLine vertical animated={hoveredSection === 'bridesmaids'} />
            <p className="text-xs text-rose-500 uppercase tracking-wider mb-3 mt-2">Bridesmaids</p>
            <div className="flex flex-wrap justify-center gap-3">
              {familyData.weddingParty.bridesmaids.map((person, i) => (
                <motion.div
                  key={person.id}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.9 + i * 0.08 }}
                >
                  <PersonCard 
                    person={person} 
                    onClick={() => setSelectedPerson(person.id)}
                    isSelected={selectedPerson === person.id}
                  />
                </motion.div>
              ))}
            </div>
          </div>

          {/* Groomsmen */}
          <div 
            className="flex flex-col items-center"
            onMouseEnter={() => setHoveredSection('groomsmen')}
            onMouseLeave={() => setHoveredSection(null)}
          >
            <ConnectionLine vertical animated={hoveredSection === 'groomsmen'} />
            <p className="text-xs text-blue-500 uppercase tracking-wider mb-3 mt-2">Groomsmen</p>
            <div className="flex flex-wrap justify-center gap-3">
              {familyData.weddingParty.groomsmen.map((person, i) => (
                <motion.div
                  key={person.id}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.9 + i * 0.08 }}
                >
                  <PersonCard 
                    person={person} 
                    onClick={() => setSelectedPerson(person.id)}
                    isSelected={selectedPerson === person.id}
                  />
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Selected Person Detail */}
        <AnimatePresence>
          {selectedPerson && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="mt-12 text-center"
            >
              <div className="inline-flex items-center gap-3 bg-white rounded-full px-6 py-3 shadow-lg border border-gold-200/60">
                <Sparkles className="w-4 h-4 text-gold-500" />
                <p className="text-charcoal-700 text-sm">
                  <span className="font-medium">
                    {familyData.couple.find(p => p.id === selectedPerson)?.name || 
                     [...familyData.parents.bride, ...familyData.parents.groom].find(p => p.id === selectedPerson)?.name ||
                     [...familyData.weddingParty.bridesmaids, ...familyData.weddingParty.groomsmen].find(p => p.id === selectedPerson)?.name}
                  </span>
                  <span className="text-charcoal-500"> — Click to learn more about their role in our wedding</span>
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
