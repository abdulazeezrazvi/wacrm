import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/automations/admin-client'

/**
 * GET /api/admin/config — fetch the single saas_settings row.
 * Public read is allowed by RLS, but we gate on admin for consistency.
 */
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify admin role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const db = supabaseAdmin()
  const { data, error } = await db
    .from('saas_settings')
    .select('*')
    .limit(1)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ settings: data })
}

/**
 * PATCH /api/admin/config — update the saas_settings row.
 * Uses service-role key to bypass RLS so admin writes always succeed.
 * Admin check is done server-side via the user's session JWT.
 */
export async function PATCH(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify admin role server-side
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden: admin role required' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }

  // Only include fields that were sent
  if (body.starter_price !== undefined) payload.starter_price = Number(body.starter_price) || 0
  if (body.pro_price !== undefined) payload.pro_price = Number(body.pro_price) || 0
  if (body.free_code !== undefined) payload.free_code = body.free_code?.trim() || null
  if (body.discount_code !== undefined) payload.discount_code = body.discount_code?.trim() || null
  if (body.discount_percentage !== undefined) payload.discount_percentage = Number(body.discount_percentage) || 0

  const db = supabaseAdmin()

  if (body.id) {
    // Update existing row
    const { data, error } = await db
      .from('saas_settings')
      .update(payload)
      .eq('id', body.id)
      .select()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data || data.length === 0) {
      return NextResponse.json({ error: 'No matching settings row found' }, { status: 404 })
    }
    return NextResponse.json({ settings: data[0] })
  } else {
    // Insert new row
    const { data, error } = await db
      .from('saas_settings')
      .insert(payload)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ settings: data }, { status: 201 })
  }
}
