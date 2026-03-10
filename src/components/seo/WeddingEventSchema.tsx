import { useEffect } from 'react'

interface WeddingEventSchemaProps {
  startDate: string
  endDate?: string
  location: {
    name: string
    address: string
    latitude?: number
    longitude?: number
  }
  couple: {
    partner1: { name: string; url?: string }
    partner2: { name: string; url?: string }
  }
  image?: string
  description?: string
}

/**
 * WeddingEventSchema - Schema.org structured data for wedding events
 * 
 * Helps search engines understand the wedding event and can display
 * rich snippets in search results.
 */
export function WeddingEventSchema({
  startDate,
  endDate,
  location,
  couple,
  image,
  description,
}: WeddingEventSchemaProps) {
  useEffect(() => {
    const baseUrl = import.meta.env.VITE_SITE_URL || 'https://austinandjordyn.wedding'
    
    const schema = {
      '@context': 'https://schema.org',
      '@type': 'Event',
      name: `${couple.partner1.name} & ${couple.partner2.name}'s Wedding`,
      description: description || `Join us in celebrating the marriage of ${couple.partner1.name} and ${couple.partner2.name}.`,
      startDate,
      endDate: endDate || startDate,
      eventStatus: 'https://schema.org/EventScheduled',
      eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
      image: image ? (image.startsWith('http') ? image : `${baseUrl}${image}`) : undefined,
      location: {
        '@type': 'Place',
        name: location.name,
        address: {
          '@type': 'PostalAddress',
          streetAddress: location.address,
        },
        ...(location.latitude && location.longitude && {
          geo: {
            '@type': 'GeoCoordinates',
            latitude: location.latitude,
            longitude: location.longitude,
          },
        }),
      },
      performer: [
        {
          '@type': 'Person',
          name: couple.partner1.name,
          ...(couple.partner1.url && { url: couple.partner1.url }),
        },
        {
          '@type': 'Person',
          name: couple.partner2.name,
          ...(couple.partner2.url && { url: couple.partner2.url }),
        },
      ],
      organizer: {
        '@type': 'Person',
        name: `${couple.partner1.name} & ${couple.partner2.name}`,
      },
    }

    // Add script tag
    let script = document.getElementById('wedding-event-schema') as HTMLScriptElement
    if (!script) {
      script = document.createElement('script')
      script.id = 'wedding-event-schema'
      script.setAttribute('type', 'application/ld+json')
      document.head.appendChild(script)
    }
    script.textContent = JSON.stringify(schema)

    return () => {
      // Cleanup
      if (script) {
        script.remove()
      }
    }
  }, [startDate, endDate, location, couple, image, description])

  return null
}

export default WeddingEventSchema
