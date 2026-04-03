/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext } from 'react'

interface HalloweenContextValue {
  isHalloweenVisible: boolean
  setHalloweenVisible: React.Dispatch<React.SetStateAction<boolean>>
}

const HalloweenContext = createContext<HalloweenContextValue | undefined>(undefined)

interface HalloweenProviderProps {
  children: React.ReactNode
}

export const HalloweenProvider = ({ children }: HalloweenProviderProps) => {
  const [isHalloweenVisible, setHalloweenVisible] = React.useState(false)

  return (
    <HalloweenContext.Provider value={{ isHalloweenVisible, setHalloweenVisible }}>
      {children}
    </HalloweenContext.Provider>
  )
}

export const useHalloween = (): HalloweenContextValue => {
  const context = useContext(HalloweenContext)
  if (!context) {
    throw new Error('useHalloween must be used within a HalloweenProvider')
  }
  return context
}

export default HalloweenContext
