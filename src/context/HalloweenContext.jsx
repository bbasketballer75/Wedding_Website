import React, { createContext } from 'react'

const HalloweenContext = createContext()

export const HalloweenProvider = ({ children }) => {
  const [isHalloweenVisible, setHalloweenVisible] = React.useState(false)

  return (
    <HalloweenContext.Provider value={{ isHalloweenVisible, setHalloweenVisible }}>
      {children}
    </HalloweenContext.Provider>
  )
}
