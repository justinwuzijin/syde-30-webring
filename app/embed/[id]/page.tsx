import { notFound } from 'next/navigation'
import { getSupabaseAdmin } from '@/lib/supabase'
import { type Member, getDisplayUrl } from '@/types/member'
import { PolaroidStatic, POLAROID_WIDTH, POLAROID_HEIGHT } from '@/components/polaroid-static'

export const revalidate = 60

function toSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

function rowToMember(row: Record<string, unknown>): Member {
  return {
    id: toSlug((row.name as string) || ''),
    name: (row.name as string) || '',
    embedUrl: (row.website_link as string) || '',
    polaroid_still_url: (row.polaroid_still_url as string) || null,
    polaroid_live_url: (row.polaroid_live_url as string) || null,
    socials: {
      website: (row.website_link as string) || undefined,
      linkedin: (row.linkedin_handle as string) || undefined,
      twitter: (row.twitter_handle as string) || undefined,
      github: (row.github_handle as string) || undefined,
    },
    connections: [],
    approved: true,
    joinedAt: (row.joined_at as string) || (row.created_at as string) || new Date().toISOString(),
  }
}

async function getMemberById(id: string): Promise<Member | null> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('members')
    .select('*')
    .eq('approved', true)
    .order('joined_at', { ascending: true })

  if (error || !data) return null

  const members = data.map((row) => rowToMember(row as Record<string, unknown>))
  const idLower = id.toLowerCase().trim()

  let member = members.find((m) => m.id === idLower)
  if (!member) {
    const firstPart = idLower.split('-')[0] ?? idLower
    member = members.find((m) => {
      const firstName = m.name.split(/\s+/)[0]?.toLowerCase() ?? ''
      return firstName === firstPart
    })
  }
  return member ?? null
}

// Allow this page to be framed by any origin
export async function generateMetadata() {
  return {
    other: {
      'X-Frame-Options': 'ALLOWALL',
    },
  }
}

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function EmbedPage({ params }: PageProps) {
  const { id } = await params
  const member = await getMemberById(id)

  if (!member) notFound()

  // Preload the photo so the browser fetches it in parallel with rendering
  const photoUrl = member.polaroid_still_url
    ?? (getDisplayUrl(member)
      ? `https://api.microlink.io/?url=${encodeURIComponent(getDisplayUrl(member))}&screenshot=true&meta=false&embed=screenshot.url`
      : null)

  // Extra padding so the hover scale doesn't clip against the iframe edge
  const pad = 24

  return (
    <>
      {photoUrl && (
        // eslint-disable-next-line @next/next/no-head-element
        <head>
          <link rel="preload" as="image" href={photoUrl} />
        </head>
      )}
      <div
        style={{
          width: POLAROID_WIDTH + pad * 2,
          height: POLAROID_HEIGHT + pad * 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <PolaroidStatic member={member} />
      </div>
    </>
  )
}
