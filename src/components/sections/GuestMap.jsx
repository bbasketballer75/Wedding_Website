import React, { useState, useEffect, useCallback } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet'
import { supabase } from '@/lib/supabase'
import { motion } from 'framer-motion'
import storage from '@/utils/storage'
import logger from '@/utils/logger'
import { MAP_CONFIG, TIMING, VIDEO_CONFIG } from '@/config/constants'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import Button from '@/components/ui/Button'

// Fix Leaflet icon issue
import icon from 'leaflet/dist/images/marker-icon.png'
import iconShadow from 'leaflet/dist/images/marker-shadow.png'

const DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
})

L.Marker.prototype.options.icon = DefaultIcon

const MapEvents = ({ onMapClick }) => {
  useMapEvents({
    click: onMapClick,
  })
  return null
}

const RecenterMap = ({ pins }) => {
  const map = useMap()

  useEffect(() => {
    const validPins = (pins || []).filter(
      pin => pin && typeof pin.latitude === 'number' && typeof pin.longitude === 'number'
    )
    if (validPins.length > 0) {
      const bounds = L.latLngBounds(validPins.map(pin => [pin.latitude, pin.longitude]))
      map.fitBounds(bounds, { padding: MAP_CONFIG.padding })
    }
  }, [pins, map])

  return null
}

const FitBounds = ({ pins }) => {
  const map = useMap()

  useEffect(() => {
    const validPins = (pins || []).filter(
      pin => pin && typeof pin.latitude === 'number' && typeof pin.longitude === 'number'
    )
    if (validPins.length > 0) {
      const bounds = L.latLngBounds(validPins.map(pin => [pin.latitude, pin.longitude]))
      map.fitBounds(bounds, { padding: MAP_CONFIG.padding })
    }
  }, [pins, map])

  return null
}

const GuestMap = () => {
  const [pins, setPins] = useState([])
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [myPinId, setMyPinId] = useState(storage.getItem(VIDEO_CONFIG.guestPinStorageKey))

  const fetchPins = useCallback(async () => {
    const { data, error } = await supabase
      .from('guest_pins')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      logger.error('Error fetching pins:', error)
      return []
    }

    return data || []
  }, [])

  // Initial fetch and subscription
  useEffect(() => {
    let isMounted = true

    // Initial fetch
    const doInitialFetch = async () => {
      const data = await fetchPins()
      if (isMounted) {
        setPins(data)
      }
    }

    doInitialFetch()

    // Subscribe to real-time updates
    const subscription = supabase
      .channel('guest_pins')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'guest_pins',
        },
        async () => {
          if (isMounted) {
            const data = await fetchPins()
            setPins(data)
          }
        }
      )
      .subscribe()

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [fetchPins])

  const handleMapClick = async e => {
    if (myPinId) {
      // User already has a pin
      return
    }

    const { lat, lng } = e.latlng
    await addPin(lat, lng)
  }

  const addPin = async (latitude, longitude) => {
    setLoading(true)
    setMessage('')

    const { data, error } = await supabase
      .from('guest_pins')
      .insert([
        {
          latitude,
          longitude,
          created_at: new Date().toISOString(),
        },
      ])
      .select()

    if (error) {
      logger.error('Error adding pin:', error)
      setMessage('Failed to add your pin. Please try again.')
      setLoading(false)
      return
    }

    if (data && data[0]) {
      setMyPinId(data[0].id)
      storage.setItem(VIDEO_CONFIG.guestPinStorageKey, data[0].id)
    }

    setLoading(false)
  }

  const removeMyPin = async () => {
    if (!myPinId) return

    setLoading(true)

    const { error } = await supabase.from('guest_pins').delete().eq('id', myPinId)

    if (error) {
      logger.error('Error removing pin:', error)
      setMessage('Failed to remove your pin. Please try again.')
      setLoading(false)
      return
    }

    setMyPinId(null)
    storage.removeItem(VIDEO_CONFIG.guestPinStorageKey)
    setLoading(false)
  }

  return (
    <section id='guest-map' className='py-20 bg-dark-900'>
      <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className='text-center mb-12'
        >
          <h2 className='text-4xl font-bold font-display text-cream-50 mb-4'>Guest Map</h2>
          <p className='text-lg font-light text-dark-400 mb-4'>
            Click on the map to add your pin and show where you're coming from!
          </p>
          {myPinId ? (
            <Button
              onClick={removeMyPin}
              disabled={loading}
              className='bg-red-600 text-white hover:bg-red-700'
            >
              {loading ? 'Removing...' : 'Remove My Pin'}
            </Button>
          ) : (
            <p className='text-sm text-gold-500'>Click anywhere on the map to place your pin</p>
          )}
        </motion.div>

        {message && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className='mb-4 p-4 bg-red-900/50 border border-red-500/50 text-red-200 rounded-lg text-center'
          >
            {message}
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className='rounded-xl overflow-hidden shadow-2xl border border-white/10'
          style={{ height: '500px' }}
        >
          <MapContainer
            center={MAP_CONFIG.defaultCenter}
            zoom={MAP_CONFIG.defaultZoom}
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
            />
            <MapEvents onMapClick={handleMapClick} />
            <RecenterMap pins={pins} />

            {pins
              .filter(
                pin => pin && typeof pin.latitude === 'number' && typeof pin.longitude === 'number'
              )
              .map(pin => (
                <Marker key={pin.id} position={[pin.latitude, pin.longitude]}>
                  <Popup>
                    <div className='text-center'>
                      <p className='font-medium'>Guest #{String(pin.id).slice(0, 8)}</p>
                      <p className='text-xs text-gray-500'>
                        {new Date(pin.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </Popup>
                </Marker>
              ))}
          </MapContainer>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className='mt-8 text-center'
        >
          <p className='text-sm text-dark-400'>
            {pins.length} guest{pins.length !== 1 ? 's' : ''} have added their pin!
          </p>
        </motion.div>
      </div>
    </section>
  )
}

export default GuestMap
