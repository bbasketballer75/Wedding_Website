

interface StructuredDataProps {
  data: Record<string, unknown> | null | undefined
}

const StructuredData = ({ data }: StructuredDataProps) => {
  if (!data) return null

  return <script type='application/ld+json'>{JSON.stringify(data)}</script>
}

export default StructuredData
