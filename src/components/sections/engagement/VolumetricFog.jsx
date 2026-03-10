import React from 'react'
import { motion } from 'framer-motion'

// Volumetric Realistic Fog
const VolumetricFog = ({ visible = true }) => {
  if (!visible) return null

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: '60%',
        overflow: 'hidden',
        pointerEvents: 'none',
        zIndex: 3,
      }}
    >
      {/* Base ground fog layer - dense and slow */}
      <motion.div
        animate={
          visible
            ? {
                x: ['-5%', '5%', '-5%'],
                scaleY: [1, 1.1, 1],
              }
            : {}
        }
        transition={{ duration: 40, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          position: 'absolute',
          bottom: '-10%',
          left: '-10%',
          width: '120%',
          height: '35%',
          background:
            'linear-gradient(to top, rgba(60,50,80,0.9) 0%, rgba(80,65,100,0.6) 50%, transparent 100%)',
          filter: 'blur(30px)',
        }}
      />

      {/* Mid fog - flowing wisps */}
      <motion.div
        animate={
          visible
            ? {
                x: ['0%', '15%', '0%', '-10%', '0%'],
                opacity: [0.5, 0.7, 0.5, 0.6, 0.5],
              }
            : {}
        }
        transition={{ duration: 25, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          position: 'absolute',
          bottom: '5%',
          left: '-15%',
          width: '80%',
          height: '50%',
          background:
            'radial-gradient(ellipse 100% 80% at 40% 90%, rgba(100,80,120,0.7) 0%, transparent 70%)',
          filter: 'blur(40px)',
        }}
      />

      {/* Second mid wisp - opposite direction */}
      <motion.div
        animate={
          visible
            ? {
                x: ['0%', '-12%', '0%', '8%', '0%'],
                opacity: [0.4, 0.6, 0.5, 0.4, 0.4],
              }
            : {}
        }
        transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut', delay: 5 }}
        style={{
          position: 'absolute',
          bottom: '10%',
          right: '-10%',
          width: '70%',
          height: '45%',
          background:
            'radial-gradient(ellipse 100% 70% at 60% 85%, rgba(90,70,110,0.6) 0%, transparent 65%)',
          filter: 'blur(35px)',
        }}
      />

      {/* Rising tendrils - multiple */}
      {[0, 1, 2].map(i => (
        <motion.div
          key={i}
          animate={
            visible
              ? {
                  y: ['0%', '-15%', '-5%', '-20%', '0%'],
                  x: [
                    `${i * 30}%`,
                    `${i * 30 + 5}%`,
                    `${i * 30 - 3}%`,
                    `${i * 30 + 2}%`,
                    `${i * 30}%`,
                  ],
                  opacity: [0.3, 0.5, 0.4, 0.6, 0.3],
                  scaleX: [1, 1.2, 0.9, 1.1, 1],
                }
              : {}
          }
          transition={{ duration: 18 + i * 3, repeat: Infinity, ease: 'easeInOut', delay: i * 4 }}
          style={{
            position: 'absolute',
            bottom: '20%',
            left: `${10 + i * 25}%`,
            width: '25%',
            height: '40%',
            background: `radial-gradient(ellipse 60% 100% at 50% 100%, rgba(${110 + i * 10},${
              90 + i * 5
            },${130 + i * 5},0.5) 0%, transparent 60%)`,
            filter: 'blur(25px)',
          }}
        />
      ))}

      {/* Surface mist ribbons */}
      <motion.div
        animate={visible ? { x: ['-20%', '20%', '-20%'] } : {}}
        transition={{ duration: 50, repeat: Infinity, ease: 'linear' }}
        style={{
          position: 'absolute',
          bottom: '0%',
          left: '-20%',
          width: '140%',
          height: '12%',
          background:
            'linear-gradient(90deg, transparent, rgba(150,130,170,0.5) 20%, transparent 40%, rgba(140,120,160,0.4) 60%, transparent 80%, rgba(150,130,170,0.5) 95%, transparent)',
          filter: 'blur(12px)',
        }}
      />

      {/* Secondary surface ribbon - faster */}
      <motion.div
        animate={visible ? { x: ['30%', '-30%', '30%'] } : {}}
        transition={{ duration: 35, repeat: Infinity, ease: 'linear' }}
        style={{
          position: 'absolute',
          bottom: '2%',
          left: '-10%',
          width: '120%',
          height: '8%',
          background:
            'linear-gradient(90deg, transparent 10%, rgba(130,115,150,0.4) 30%, transparent 50%, rgba(140,125,160,0.35) 70%, transparent 90%)',
          filter: 'blur(10px)',
          willChange: 'transform, opacity',
        }}
      />

      {/* Ambient glow from fog */}
      <div
        style={{
          position: 'absolute',
          bottom: '0',
          left: '0',
          right: '0',
          height: '25%',
          background: 'linear-gradient(to top, rgba(70,55,90,0.4) 0%, transparent 100%)',
          filter: 'blur(20px)',
        }}
      />
    </div>
  )
}

export default VolumetricFog
