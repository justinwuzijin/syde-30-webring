import type { Member } from '@/types/member'

export const MOCK_MEMBERS: Member[] = [
  {
    id: 'justin-wu',
    name: 'Justin Wu',
    program: 'SYDE 2030',
    embedUrl: 'https://justinzwu.com',
    socials: { github: 'justinwuzijin', linkedin: 'justinzijinwu' },
    connections: ['leo-zhang'],
    approved: true,
    joinedAt: '2026-03-01T00:00:00Z',
  },
  {
    id: 'leo-zhang',
    name: 'Leo Zhang',
    program: 'SYDE 2030',
    embedUrl: 'https://leo-zhang.com/',
    socials: { github: 'leozhang', twitter: 'leozhang' },
    connections: ['justin-wu'],
    approved: true,
    joinedAt: '2026-03-01T00:00:00Z',
  },
  {
    id: 'sara-kim',
    name: 'Sara Kim',
    program: 'SYDE 2030',
    embedUrl: 'https://sarakim.io',
    socials: { instagram: 'sarakim', linkedin: 'sara-kim-uw' },
    connections: ['justin-wu', 'alex-chen'],
    approved: true,
    joinedAt: '2026-03-02T00:00:00Z',
  },
  {
    id: 'maya-patel',
    name: 'Maya Patel',
    program: 'SYDE 2030',
    embedUrl: 'https://mayapatel.design',
    socials: { website: 'https://mayapatel.design', github: 'mayapatel' },
    connections: ['sara-kim', 'alex-chen'],
    approved: true,
    joinedAt: '2026-03-03T00:00:00Z',
  },
  {
    id: 'liam-nguyen',
    name: 'Liam Nguyen',
    program: 'SYDE 2030',
    embedUrl: 'https://liamnguyen.ca',
    socials: { github: 'liamnguyen', linkedin: 'liam-nguyen-syde' },
    connections: ['justin-wu', 'maya-patel'],
    approved: true,
    joinedAt: '2026-03-04T00:00:00Z',
  },
  {
    id: 'emma-zhang',
    name: 'Emma Zhang',
    program: 'SYDE 2030',
    embedUrl: 'https://emmazhang.dev',
    socials: { github: 'emmazhang', twitter: 'emzhang_dev' },
    connections: ['alex-chen', 'liam-nguyen', 'sara-kim'],
    approved: true,
    joinedAt: '2026-03-05T00:00:00Z',
  },
  {
    id: 'omar-hassan',
    name: 'Omar Hassan',
    program: 'SYDE 2030',
    embedUrl: 'https://omarhassan.me',
    socials: { github: 'omarhassan', linkedin: 'omar-hassan' },
    connections: ['justin-wu', 'emma-zhang'],
    approved: true,
    joinedAt: '2026-03-06T00:00:00Z',
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
