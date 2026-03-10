import React from 'react'

const StructuredData = ({ data }) => {
  if (!data) return null

  return <script type='application/ld+json'>{JSON.stringify(data)}</script>
}

export default StructuredData
