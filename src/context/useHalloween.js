import { useContext } from 'react'
import { HalloweenContext } from './HalloweenContext'

export const useHalloween = () => {
  const context = useContext(HalloweenContext)
  if (context === undefined) {
    throw new Error('useHalloween must be used within a HalloweenProvider')
  }
  return context
}
