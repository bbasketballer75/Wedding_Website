
const NoiseOverlay = () => {
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 9998, // Just below cursor/modal
        opacity: 0.03,
        mixBlendMode: 'overlay',
      }}
    >
      <svg
        viewBox='0 0 200 200'
        xmlns='http://www.w3.org/2000/svg'
        style={{
          width: '100%',
          height: '100%',
          filter: 'contrast(120%) brightness(120%)',
        }}
      >
        <filter id='noiseFilter'>
          <feTurbulence
            type='fractalNoise'
            baseFrequency='0.65'
            numOctaves='3'
            stitchTiles='stitch'
          />
        </filter>
        <rect width='100%' height='100%' filter='url(#noiseFilter)' />
      </svg>
    </div>
  )
}

export default NoiseOverlay
