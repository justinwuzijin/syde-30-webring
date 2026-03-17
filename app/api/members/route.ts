import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import type { Member } from '@/types/member'

export const dynamic = 'force-dynamic'

function toSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

export async function GET() {
  try {
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('members')
      .select('*')
      .eq('approved', true)
      .order('joined_at', { ascending: true })
    // Note: ordering is overridden client-side (Leo, Justin first) via getSortedMembers

    if (error) {
      console.error('Failed to fetch members:', error)
      return NextResponse.json({ members: [] }, {
        status: 500,
        headers: { 'Cache-Control': 'no-store' },
      })
    }

    const members: Member[] = (data ?? []).map((row) => ({
      id: toSlug(row.name),
      name: row.name,
      embedUrl: row.website_link || '',
      polaroid_still_url: row.polaroid_still_url || null,
      polaroid_live_url: row.polaroid_live_url || null,
      socials: {
        website: row.website_link || undefined,
        linkedin: row.linkedin_handle || undefined,
        twitter: row.twitter_handle || undefined,
        github: row.github_handle || undefined,
      },
      connections: [],
      approved: true,
      joinedAt: row.joined_at || row.created_at || new Date().toISOString(),
    }))

    return NextResponse.json(
      { members },
      {
        headers: {
          'Cache-Control': 's-maxage=5, stale-while-revalidate=60',
        },
      }
    )
  } catch (err) {
    console.error('Members API error:', err)
    return NextResponse.json({ members: [] }, {
      status: 500,
      headers: { 'Cache-Control': 'no-store' },
    })
  }
}
