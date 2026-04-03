import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface Point {
  x: number
  y: number
}

interface CornerSpiderWebProps {
  corner: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  isVisible: boolean
}

// Realistic Corner Spider Web - Proper corner positioning
const CornerSpiderWeb: React.FC<CornerSpiderWebProps> = ({ corner, isVisible }) => {
  const isTop = corner.includes('top')
  const isLeft = corner.includes('left')

  const originX = isLeft ? 0 : 300
  const originY = isTop ? 0 : 300

  // Set angle range based on corner
  let startAngle = 0
  let endAngle = 90

  if (isTop && isLeft) {
    startAngle = 0
    endAngle = 90
  } else if (isTop && !isLeft) {
    startAngle = 90
    endAngle = 180
  } else if (!isTop && !isLeft) {
    startAngle = 180
    endAngle = 270
  } else if (!isTop && isLeft) {
    startAngle = 270
    endAngle = 360
  }

  const angles: number[] = []
  for (let a = startAngle; a <= endAngle; a += 8) {
    angles.push(a)
  }

  const styles: Record<string, React.CSSProperties> = {
    'top-left': { top: '0px', left: '0px' },
    'top-right': { top: '0px', right: '0px' },
    'bottom-left': { bottom: '0px', left: '0px' },
    'bottom-right': { bottom: '0px', right: '0px' },
  }

  const fmt = (val: number | string): number => {
    const num = Number(val)
    if (isNaN(num) || !isFinite(num)) return 0
    return Number(num.toFixed(2))
  }

  const safeFmt = (val: number | string): number => {
    const res = fmt(val)
    return isNaN(res) ? 0 : res
  }

  const getPoint = (radius = 0, angleDeg = 0, customOx: number | null = null, customOy: number | null = null): Point => {
    const r = Number(radius) || 0
    const a = Number(angleDeg) || 0
    const ox = typeof customOx === 'number' ? customOx : typeof originX === 'number' ? originX : 0
    const oy = typeof customOy === 'number' ? customOy : typeof originY === 'number' ? originY : 0

    const x = ox + r * Math.cos((a * Math.PI) / 180)
    const y = oy + r * Math.sin((a * Math.PI) / 180)

    return {
      x: isNaN(x) ? ox : x,
      y: isNaN(y) ? oy : y,
    }
  }

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.svg
          viewBox='0 0 300 300'
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 0.7, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ duration: 0.6 }}
          style={{
            position: 'absolute',
            ...(styles[corner] || styles['top-left']),
            width: '280px',
            height: '280px',
            zIndex: 5,
            pointerEvents: 'none',
            filter: 'drop-shadow(0 0 10px rgba(255, 255, 255, 0.3))',
          }}
        >
          {/* Gradient definitions for fading web ends */}
          <defs>
            <radialGradient id={`web-fade-${corner}`} cx={isLeft ? '0%' : '100%'} cy='0%' r='100%'>
              <stop offset='0%' stopColor='white' stopOpacity='1' />
              <stop offset='60%' stopColor='white' stopOpacity='0.7' />
              <stop offset='85%' stopColor='white' stopOpacity='0.3' />
              <stop offset='100%' stopColor='white' stopOpacity='0' />
            </radialGradient>
            <mask id={`web-mask-${corner}`}>
              <rect x='0' y='0' width='300' height='300' fill={`url(#web-fade-${corner})`} />
            </mask>
          </defs>

          {/* Web group with fade mask */}
          <g mask={`url(#web-mask-${corner})`}>
            {/* Main radial threads from corner */}
            {angles.map((angle, i) => {
              const endPt = getPoint(280, angle)
              const ex = safeFmt(endPt.x)
              const ey = safeFmt(endPt.y)
              const ox = safeFmt(originX)
              const oy = safeFmt(originY)

              return (
                <motion.line
                  key={`radial-${i}`}
                  x1={ox}
                  y1={oy}
                  x2={ex}
                  y2={ey}
                  stroke='rgba(200, 220, 255, 0.4)'
                  strokeWidth='1.5'
                  animate={
                    isVisible
                      ? {
                          opacity: [0.3, 0.5, 0.3],
                          strokeWidth: [1.2, 1.8, 1.2],
                        }
                      : {}
                  }
                  transition={{ duration: 4 + i * 0.5, repeat: Infinity, ease: 'easeInOut' }}
                />
              )
            })}

            {/* Curved spiral threads - increased density */}
            {[20, 40, 60, 80, 100, 120, 140, 160, 180, 200, 220, 240, 260, 280].map(
              (radius, ri) => {
                const midAngle = (startAngle + endAngle) / 2
                const startPt = getPoint(radius, startAngle)
                const midPt = getPoint(radius, midAngle)
                const endPt = getPoint(radius, endAngle)

                // Control points for smoother curve
                const ctrl1 = {
                  x:
                    safeFmt(originX) +
                    radius * 0.7 * Math.cos((((startAngle + midAngle) / 2) * Math.PI) / 180),
                  y:
                    safeFmt(originY) +
                    radius * 0.7 * Math.sin((((startAngle + midAngle) / 2) * Math.PI) / 180),
                }
                const ctrl2 = {
                  x:
                    safeFmt(originX) +
                    radius * 0.7 * Math.cos((((midAngle + endAngle) / 2) * Math.PI) / 180),
                  y:
                    safeFmt(originY) +
                    radius * 0.7 * Math.sin((((midAngle + endAngle) / 2) * Math.PI) / 180),
                }

                const pathD = `M ${safeFmt(startPt.x)} ${safeFmt(startPt.y)} Q ${safeFmt(ctrl1.x)} ${safeFmt(ctrl1.y)} ${safeFmt(
                  midPt.x
                )} ${safeFmt(midPt.y)} Q ${safeFmt(ctrl2.x)} ${safeFmt(ctrl2.y)} ${safeFmt(endPt.x)} ${safeFmt(
                  endPt.y
                )}`

                return (
                  <motion.path
                    key={`spiral-${ri}`}
                    d={pathD}
                    fill='none'
                    stroke='rgba(255,255,255,0.5)'
                    strokeWidth='0.8'
                    animate={
                      isVisible
                        ? {
                            opacity: [0.4, 0.7, 0.4],
                            strokeWidth: [0.6, 1, 0.6],
                          }
                        : {}
                    }
                    transition={{ duration: 5 + ri, repeat: Infinity, ease: 'easeInOut' }}
                  />
                )
              }
            )}

            {/* Cross threads for realism */}
            {[20, 55, 90, 125, 160, 195, 230].flatMap((r, i) =>
              [
                (startAngle || 0) + 10,
                (startAngle || 0) + 30,
                (startAngle || 0) + 50,
                (startAngle || 0) + 70,
              ]
                .map((a, j) => {
                  if (a > (endAngle || 90) - 10) return null
                  const pt1 = getPoint(r, a)
                  const pt2 = getPoint(r + 10, a + 8)
                  const x1 = safeFmt(pt1.x)
                  const y1 = safeFmt(pt1.y)
                  const x2 = safeFmt(pt2.x)
                  const y2 = safeFmt(pt2.y)

                  return (
                    <line
                      key={`cross-${i}-${j}`}
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke='rgba(255,255,255,0.3)'
                      strokeWidth='0.4'
                    />
                  )
                })
                .filter((item): item is React.ReactElement => item !== null)
            )}

            {/* Dew drops */}
            {[
              { r: 40, aOffset: 20 },
              { r: 70, aOffset: 45 },
              { r: 100, aOffset: 30 },
              { r: 130, aOffset: 60 },
              { r: 160, aOffset: 15 },
              { r: 190, aOffset: 50 },
              { r: 60, aOffset: 70 },
              { r: 110, aOffset: 80 },
              { r: 80, aOffset: 10 },
            ].map((drop, i) => {
              const angle = startAngle + (drop.aOffset / 90) * (endAngle - startAngle)
              const pt = getPoint(drop.r, angle)
              return (
                <motion.circle
                  key={`dew-${i}`}
                  cx={safeFmt(pt.x)}
                  cy={safeFmt(pt.y)}
                  r={2}
                  fill='rgba(255,255,255,0.8)'
                  animate={
                    isVisible
                      ? {
                          opacity: [0.4, 1, 0.4],
                          scale: [0.8, 1.2, 0.8],
                        }
                      : {}
                  }
                  transition={{ duration: 3, repeat: Infinity, delay: i * 0.4 }}
                />
              )
            })}
          </g>

          {/* Animated Spiders - two per corner for more life */}
          <Spider
            startRadius={100}
            angle={startAngle + 30}
            delay={0}
            getPoint={getPoint}
            originX={originX}
            originY={originY}
            safeFmt={safeFmt}
            isVisible={isVisible}
          />
          <Spider
            startRadius={180}
            angle={startAngle + 60}
            delay={2}
            getPoint={getPoint}
            originX={originX}
            originY={originY}
            safeFmt={safeFmt}
            isVisible={isVisible}
          />
        </motion.svg>
      )}
    </AnimatePresence>
  )
}

interface SpiderProps {
  startRadius: number
  angle: number
  delay: number
  getPoint: (radius?: number, angleDeg?: number, customOx?: number | null, customOy?: number | null) => Point
  safeFmt: (val: number | string) => number
  originX: number
  originY: number
  isVisible: boolean
}

// Spider component that crawls on the web
const Spider: React.FC<SpiderProps> = ({
  startRadius,
  angle,
  delay,
  getPoint,
  safeFmt,
  originX,
  originY,
  isVisible,
}) => {
  const startPt = getPoint(startRadius || 100, angle || 0, originX, originY)
  const midPt1 = getPoint((startRadius || 100) + 30, (angle || 0) + 5, originX, originY)
  const midPt2 = getPoint((startRadius || 100) + 15, (angle || 0) - 3, originX, originY)

  const dx1 = safeFmt(midPt1.x - startPt.x)
  const dy1 = safeFmt(midPt1.y - startPt.y)
  const dx2 = safeFmt(midPt2.x - startPt.x)
  const dy2 = safeFmt(midPt2.y - startPt.y)

  return (
    <motion.g
      initial={{ opacity: 0 }}
      animate={
        isVisible
          ? {
              opacity: 1,
              x: [0, dx1, dx2, 0],
              y: [0, dy1, dy2, 0],
            }
          : { opacity: 1 }
      }
      transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut', delay }}
      style={{
        filter:
          'drop-shadow(0 0 8px rgba(255, 255, 255, 0.4)) drop-shadow(0 0 16px rgba(100, 150, 255, 0.2))',
      }}
    >
      <g transform={`translate(${safeFmt(startPt.x)}, ${safeFmt(startPt.y)})`}>
        {/* Spider legs - Jointed for realism */}
        {[
          // Left side
          140, 165, 190, 215,
          // Right side
          -35, -10, 15, 40,
        ].map((legAngle, i) => {
          const isLeftSide = i < 4
          const rad = (legAngle * Math.PI) / 180
          // Leg segments
          const kneeX = 15 * Math.cos(rad) || 0
          const kneeY = 15 * Math.sin(rad) - 8 || 0
          const footX = 25 * Math.cos(rad) || 0
          const footY = 25 * Math.sin(rad) || 0
          const bodyAttachX = isLeftSide ? -8 : 8

          const path = `M ${safeFmt(bodyAttachX)} 0 L ${safeFmt(kneeX)} ${safeFmt(kneeY)} L ${safeFmt(footX)} ${safeFmt(
            footY
          )}`

          return (
            <motion.path
              key={`leg-${i}`}
              d={path}
              stroke='var(--color-dark-900)'
              strokeWidth='2'
              fill='none'
              strokeLinecap='round'
              strokeLinejoin='round'
              transition={{
                duration: 0.8 + (i % 3) * 0.2,
                repeat: Infinity,
                delay: delay + i * 0.1,
              }}
            />
          )
        })}

        {/* Spider Abdomen */}
        <ellipse cx='0' cy='5' rx='10' ry='12' fill='var(--color-dark-900)' />
        {/* Spider Cephalothorax */}
        <circle cx='0' cy='-5' r='6' fill='var(--color-dark-900)' />
        {/* Eyes */}
        <circle cx='-2' cy='-7' r='1' fill='rgba(255,255,255,0.3)' />
        <circle cx='2' cy='-7' r='1' fill='rgba(255,255,255,0.3)' />
      </g>
    </motion.g>
  )
}

export default CornerSpiderWeb
