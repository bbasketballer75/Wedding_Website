import { Link } from 'react-router-dom'
import { Camera, MessageCircle } from 'lucide-react'

export function EmptyActivityState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-4 rounded-full bg-gold-100 p-4">
        <Camera className="h-8 w-8 text-gold-500" />
      </div>
      <h2 className="font-display text-xl text-charcoal-800 mb-2">
        Be the first to contribute
      </h2>
      <p className="text-charcoal-500 mb-6 max-w-xs">
        The activity feed is empty. Share a photo or leave a message in the guestbook!
      </p>
      <div className="flex gap-4">
        <Link
          to="/upload"
          className="inline-flex items-center gap-2 rounded-full bg-gold-500 px-5 py-2 text-sm font-medium text-white hover:bg-gold-600 transition-colors"
        >
          <Camera className="h-4 w-4" />
          Share a Photo
        </Link>
        <Link
          to="/guestbook"
          className="inline-flex items-center gap-2 rounded-full border border-gold-500 px-5 py-2 text-sm font-medium text-gold-600 hover:bg-gold-50 transition-colors"
        >
          <MessageCircle className="h-4 w-4" />
          Sign Guestbook
        </Link>
      </div>
    </div>
  )
}