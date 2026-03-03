import { MOCK_MEMBERS, getEdges } from '@/lib/mock-data'
import { HomeClient } from '@/components/home-client'

export default function HomePage() {
  const members = MOCK_MEMBERS.filter((m) => m.approved)
  const edges = getEdges(members)

  return <HomeClient members={members} edges={edges} />
}
