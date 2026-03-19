import { NextResponse } from 'next/server'

// Deprecated: kept only to avoid accidental silent regressions.
// Media uploads now use direct signed uploads:
// - /api/me/polaroid/upload-url
// - /api/join/media-upload-url
export async function POST() {
  return NextResponse.json(
    { error: 'Deprecated upload route. Use signed direct-upload endpoints.' },
    { status: 410 }
  )
}

