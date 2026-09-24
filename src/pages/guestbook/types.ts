export interface Comment {
  id: string
  author: string
  content: string
  created_at: string
}

export interface Message {
  id: string
  name: string
  content: string
  timestamp: string
  reactions: Record<string, number>
  comments: Comment[]
}
