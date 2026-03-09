import type { Member } from '@/types/member'

export const MOCK_MEMBERS: Member[] = [
  {
    id: 'justin-wu',
    name: 'Justin Wu',
    embedUrl: 'https://justinzwu.com',
    socials: { github: 'justinwuzijin', linkedin: 'justinzijinwu' },
    connections: ['leo-zhang'],
    approved: true,
    joinedAt: '2026-03-01T00:00:00Z',
  },
  {
    id: 'leo-zhang',
    name: 'Leo Zhang',
    embedUrl: 'https://leo-zhang.com/',
    socials: { github: 'leozhang', twitter: 'leozhang' },
    connections: ['justin-wu'],
    approved: true,
    joinedAt: '2026-03-01T00:00:00Z',
  },
]

export interface Edge {
  source: string
  target: string
  id: string
}

export function getEdges(members: Member[]): Edge[] {
  const seen = new Set<string>()
  const edges: Edge[] = []
  for (const m of members) {
    for (const targetId of m.connections) {
      const key = [m.id, targetId].sort().join('--')
      if (!seen.has(key) && members.some((mem) => mem.id === targetId)) {
        seen.add(key)
        edges.push({ source: m.id, target: targetId, id: key })
      }
    }
  }
  return edges
}
