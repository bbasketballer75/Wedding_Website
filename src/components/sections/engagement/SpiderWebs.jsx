import React, { memo } from 'react'
import CornerSpiderWeb from './CornerSpiderWeb'

const SpiderWebs = () => {
  return (
    <div className='absolute inset-0 pointer-events-none overflow-hidden'>
      <CornerSpiderWeb corner='top-left' isVisible={true} />
      <CornerSpiderWeb corner='top-right' isVisible={true} />
      <CornerSpiderWeb corner='bottom-left' isVisible={true} />
      <CornerSpiderWeb corner='bottom-right' isVisible={true} />
    </div>
  )
}

export default memo(SpiderWebs)
