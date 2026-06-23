import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendPush } from '@/lib/push/send'

interface GideonPost {
  id: string
  title: string
  genre: string
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const secret = process.env.GIDEON_PUSH_SECRET
  if (!secret || req.headers.get('x-gideon-secret') !== secret) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 401 })
  }

  let posts: GideonPost[] = []
  try {
    const body = await req.json()
    posts = Array.isArray(body?.posts) ? body.posts : []
  } catch {
    posts = []
  }

  if (posts.length === 0) {
    return NextResponse.json({ sent: 0 })
  }

  const admin = createAdminClient()
  const { data: users, error } = await (admin as any)
    .from('users')
    .select('id, interest_vector')

  if (error || !users) {
    return NextResponse.json({ sent: 0 })
  }

  let sent = 0

  for (const post of posts) {
    for (const user of users) {
      const iv = user.interest_vector
      if (!iv || typeof iv !== 'object' || Array.isArray(iv)) continue
      if (!(post.genre in iv)) continue

      try {
        await sendPush(user.id, {
          title: `${post.genre}: new post`,
          body: post.title,
          route: '/feed',
        })
      } catch {
        // best-effort: sendPush never throws, but guard anyway
      }
      sent++
    }
  }

  return NextResponse.json({ sent })
}
