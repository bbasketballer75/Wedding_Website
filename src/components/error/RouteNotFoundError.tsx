import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'

export function RouteNotFoundError() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className='min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900'
    >
      <div className='text-center p-8'>
        <h1 className='text-6xl font-bold text-gray-900 dark:text-white mb-4'>404</h1>
        <h2 className='text-2xl font-semibold text-gray-700 dark:text-gray-300 mb-4'>
          Page Not Found
        </h2>
        <p className='text-gray-600 dark:text-gray-400 mb-8'>
          The page you're looking for doesn't exist.
        </p>
        <Link
          to='/'
          className='inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-pink-600 hover:bg-pink-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-pink-500 transition-colors'
        >
          Return Home
        </Link>
      </div>
    </motion.div>
  )
}
