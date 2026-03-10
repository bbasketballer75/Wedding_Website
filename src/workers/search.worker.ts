/**
 * Search Indexing Web Worker
 * Handles search indexing and querying off the main thread
 */

interface SearchDocument {
  id: string
  title?: string
  content: string
  tags?: string[]
  metadata?: Record<string, unknown>
}

interface SearchIndex {
  documents: Map<string, SearchDocument>
  invertedIndex: Map<string, Set<string>>
}

interface SearchMessage {
  type: 'index' | 'search' | 'clear' | 'remove'
  documents?: SearchDocument[]
  documentId?: string
  query?: string
  options?: {
    fuzzy?: boolean
    limit?: number
    fields?: string[]
  }
}

interface SearchResult {
  id: string
  score: number
  document: SearchDocument
  highlights?: string[]
}

// Initialize search index
const searchIndex: SearchIndex = {
  documents: new Map(),
  invertedIndex: new Map(),
}

// Listen for messages
self.addEventListener('message', (event: MessageEvent<SearchMessage>) => {
  const { type, documents, documentId, query, options = {} } = event.data

  try {
    let result: unknown

    switch (type) {
      case 'index':
        if (documents) {
          result = indexDocuments(documents)
        }
        break
      case 'search':
        if (query) {
          result = search(query, options)
        }
        break
      case 'remove':
        if (documentId) {
          result = removeDocument(documentId)
        }
        break
      case 'clear':
        result = clearIndex()
        break
      default:
        result = { success: false, error: `Unknown operation: ${type}` }
    }

    self.postMessage({ type, success: true, data: result })
  } catch (error) {
    self.postMessage({
      type,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})

/**
 * Index documents
 */
function indexDocuments(documents: SearchDocument[]): { indexed: number } {
  documents.forEach(doc => {
    // Store document
    searchIndex.documents.set(doc.id, doc)

    // Tokenize and index
    const tokens = tokenize(doc.content)
    const titleTokens = doc.title ? tokenize(doc.title) : []
    const tagTokens = doc.tags ? doc.tags.flatMap(tag => tokenize(tag)) : []

    const allTokens = [...tokens, ...titleTokens, ...tagTokens]

    allTokens.forEach(token => {
      if (!searchIndex.invertedIndex.has(token)) {
        searchIndex.invertedIndex.set(token, new Set())
      }
      const tokenSet = searchIndex.invertedIndex.get(token)
      if (tokenSet) {
        tokenSet.add(doc.id)
      }
    })
  })

  return { indexed: documents.length }
}

/**
 * Search indexed documents
 */
function search(
  query: string,
  options: { fuzzy?: boolean; limit?: number; fields?: string[] } = {}
): SearchResult[] {
  const { fuzzy = false, limit = 10 } = options

  const queryTokens = tokenize(query)
  const documentScores = new Map<string, number>()

  queryTokens.forEach(token => {
    // Exact match
    const exactMatches = searchIndex.invertedIndex.get(token)
    if (exactMatches) {
      exactMatches.forEach(docId => {
        documentScores.set(docId, (documentScores.get(docId) || 0) + 2)
      })
    }

    // Fuzzy match if enabled
    if (fuzzy) {
      searchIndex.invertedIndex.forEach((docIds, indexedToken) => {
        if (levenshteinDistance(token, indexedToken) <= 2) {
          docIds.forEach(docId => {
            documentScores.set(docId, (documentScores.get(docId) || 0) + 1)
          })
        }
      })
    }
  })

  // Convert to results and sort by score
  const results: SearchResult[] = []
  
  for (const [id, score] of documentScores.entries()) {
    const document = searchIndex.documents.get(id)
    if (document) {
      results.push({
        id,
        score,
        document,
        highlights: extractHighlights(document, queryTokens),
      })
    }
  }

  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}

/**
 * Remove document from index
 */
function removeDocument(documentId: string): { removed: boolean } {
  const document = searchIndex.documents.get(documentId)

  if (!document) {
    return { removed: false }
  }

  // Remove from inverted index
  searchIndex.invertedIndex.forEach(docIds => {
    docIds.delete(documentId)
  })

  // Remove document
  searchIndex.documents.delete(documentId)

  return { removed: true }
}

/**
 * Clear all indexes
 */
function clearIndex(): { cleared: boolean } {
  searchIndex.documents.clear()
  searchIndex.invertedIndex.clear()
  return { cleared: true }
}

/**
 * Tokenize text
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(token => token.length > 2)
}

/**
 * Calculate Levenshtein distance for fuzzy matching
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = []

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i]
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        )
      }
    }
  }

  return matrix[b.length][a.length]
}

/**
 * Extract highlights from document
 */
function extractHighlights(document: SearchDocument, queryTokens: string[]): string[] {
  const content = document.content.toLowerCase()
  const highlights: string[] = []

  queryTokens.forEach(token => {
    const index = content.indexOf(token)
    if (index !== -1) {
      const start = Math.max(0, index - 30)
      const end = Math.min(content.length, index + token.length + 30)
      const highlight = document.content.substring(start, end)
      highlights.push(`...${highlight}...`)
    }
  })

  return highlights.slice(0, 3) // Limit to 3 highlights
}

export {
  indexDocuments,
  search,
  removeDocument,
  clearIndex,
  tokenize,
  levenshteinDistance,
  extractHighlights
}