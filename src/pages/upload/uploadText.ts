export function formatMediaCount(count: number, singular: string, plural = `${singular}s`) {
  return count === 1 ? `1 ${singular}` : `${count} ${plural}`
}

export function describeUploadSummary(photoCount: number, videoCount: number) {
  const parts: string[] = []
  if (photoCount > 0) parts.push(formatMediaCount(photoCount, 'photo'))
  if (videoCount > 0) parts.push(formatMediaCount(videoCount, 'video'))

  if (parts.length === 0) return 'your upload'
  if (parts.length === 1) return parts[0]
  return `${parts[0]} and ${parts[1]}`
}

export function describeSubmitLabel(photoCount: number, videoCount: number) {
  if (photoCount === 0 && videoCount === 0) {
    return 'Choose your files first'
  }

  return `Submit ${describeUploadSummary(photoCount, videoCount)}`
}
