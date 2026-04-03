import { motion } from 'framer-motion'

interface ElegantDividerProps {
  color?: string
  width?: string
  opacity?: number
}

const ElegantDivider = ({ color = 'currentColor', width = '100%', opacity = 0.3 }: ElegantDividerProps) => {
  return (
    <div className='flex justify-center my-8 text-gold-500' style={{ width, opacity }}>
      <motion.svg
        width='160'
        height='24'
        viewBox='0 0 160 24'
        initial={{ opacity: 0, scale: 0.8 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 1 }}
      >
        <path
          d='M 0,12 Q 40,12 80,12 Q 120,12 160,12'
          stroke={color}
          strokeWidth='0.5'
          fill='none'
        />
        {/* Simplified Floral Flourish Center */}
        <path
          d='M 70,12 C 70,6 76,2 80,8 C 84,2 90,6 90,12 C 90,18 84,22 80,16 C 76,22 70,18 70,12 Z'
          fill='none'
          stroke={color}
          strokeWidth='0.8'
        />
        <circle cx='80' cy='12' r='1.5' fill={color} />
      </motion.svg>
    </div>
  )
}

export default ElegantDivider
