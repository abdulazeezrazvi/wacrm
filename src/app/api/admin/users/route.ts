import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/automations/admin-client'

// Helper to check if current request user is admin
async function checkAdminStatus() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized', status: 401 }

  // Verify admin role server-side
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') {
    return { error: 'Forbidden: admin role required', status: 403 }
  }

  return { user }
}

/**
 * GET /api/admin/users — fetch all profiles.
 * Uses service role to bypass client RLS.
 */
export async function GET() {
  const check = await checkAdminStatus()
  if ('error' in check) {
    return NextResponse.json({ error: check.error }, { status: check.status })
  }

  const db = supabaseAdmin()
  const { data, error } = await db
    .from('profiles')
    .select('id, user_id, full_name, email, role, avatar_url, created_at')
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ users: data })
}

/**
 * PATCH /api/admin/users — update a user's profile.
 * Typically to toggle role between 'admin' and 'user'.
 */
export async function PATCH(request: Request) {
  const check = await checkAdminStatus()
  if ('error' in check) {
    return NextResponse.json({ error: check.error }, { status: check.status })
  }

  const body = await request.json().catch(() => null)
  if (!body || !body.id) {
    return NextResponse.json({ error: 'Missing user profile ID' }, { status: 400 })
  }

  const payload: Record<string, unknown> = {}
  if (body.role !== undefined) {
    if (body.role !== 'admin' && body.role !== 'user') {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    }
    payload.role = body.role
  }

  payload.updated_at = new Date().toISOString()

  const db = supabaseAdmin()
  const { data, error } = await db
    .from('profiles')
    .update(payload)
    .eq('id', body.id)
    .select()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!data || data.length === 0) {
    return NextResponse.json({ error: 'User profile not found' }, { status: 404 })
  }

  return NextResponse.json({ user: data[0] })
}

/**
 * DELETE /api/admin/users — delete a user account from auth.users (cascades to profiles).
 */
export async function DELETE(request: Request) {
  const check = await checkAdminStatus()
  if ('error' in check) {
    return NextResponse.json({ error: check.error }, { status: check.status })
  }

  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId')
  if (!userId) {
    return NextResponse.json({ error: 'Missing userId parameter' }, { status: 400 })
  }

  // Prevent self-deletion
  if (userId === check.user.id) {
    return NextResponse.json({ error: 'Cannot delete your own admin account' }, { status: 400 })
  }

  const db = supabaseAdmin()

  // Verify the target user exists and is not an admin
  const { data: targetProfile, error: profileError } = await db
    .from('profiles')
    .select('role')
    .eq('user_id', userId)
    .maybeSingle()

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 })
  }

  if (!targetProfile) {
    return NextResponse.json({ error: 'User profile not found' }, { status: 404 })
  }

  if (targetProfile.role === 'admin') {
    return NextResponse.json({ error: 'Cannot delete another admin account' }, { status: 403 })
  }

  // Delete from auth.users — this cascades and deletes the profile, contacts, deals, etc.
  const { error: deleteError } = await db.auth.admin.deleteUser(userId)

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
