import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import type { Member } from '@/types/member'

export const dynamic = 'force-dynamic'

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
    joinedAt:
      (row.joined_at as string) ||
      (row.created_at as string) ||
      new Date().toISOString(),
  }
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params
  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  }

  try {
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('members')
      .select('*')
      .eq('approved', true)
      .order('joined_at', { ascending: true })

    if (error) {
      console.error('Failed to fetch members:', error)
      return NextResponse.json(
        { error: 'Failed to fetch member' },
        { status: 500, headers: { 'Cache-Control': 'no-store' } }
      )
    }

    const members: Member[] = (data ?? []).map((row) => rowToMember(row))
    const idLower = id.toLowerCase().trim()
    let member = members.find((m) => m.id === idLower)
    // Fallback: match by first name (e.g. "leo" or "leo-zhang" finds "Leo" or "Leo Zhang")
    if (!member) {
      const idFirstPart = idLower.split('-')[0] ?? idLower
      member = members.find((m) => {
        const firstName = m.name.split(/\s+/)[0]?.toLowerCase() ?? ''
        return firstName === idFirstPart
      })
    }

    if (!member) {
      return NextResponse.json({ error: 'Member not found' }, {
        status: 404,
        headers: { 'Cache-Control': 's-maxage=60' },
      })
    }

    return NextResponse.json(member, {
      headers: {
        'Cache-Control': 's-maxage=60, stale-while-revalidate=300',
      },
    })
  } catch (err) {
    console.error('Members [id] API error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    )
  }
}
