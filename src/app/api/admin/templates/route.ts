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
 * POST /api/admin/templates — publish a user's automation as a global template.
 * Restricted to administrators only.
 */
export async function POST(request: Request) {
  const check = await checkAdminStatus()
  if ('error' in check) {
    return NextResponse.json({ error: check.error }, { status: check.status })
  }

  const body = await request.json().catch(() => null)
  if (!body || !body.automationId) {
    return NextResponse.json({ error: 'Missing automationId parameter' }, { status: 400 })
  }

  const db = supabaseAdmin()

  // 1. Fetch the target automation
  const { data: automation, error: autoError } = await db
    .from('automations')
    .select('*')
    .eq('id', body.automationId)
    .maybeSingle()

  if (autoError) {
    return NextResponse.json({ error: autoError.message }, { status: 500 })
  }
  if (!automation) {
    return NextResponse.json({ error: 'Automation not found' }, { status: 404 })
  }

  // 2. Fetch all steps for this automation, ordered by position
  const { data: steps, error: stepsError } = await db
    .from('automation_steps')
    .select('*')
    .eq('automation_id', body.automationId)
    .order('position', { ascending: true })

  if (stepsError) {
    return NextResponse.json({ error: stepsError.message }, { status: 500 })
  }

  const dbSteps = steps || []

  // 3. Serialize steps into the flat array layout containing computed parent_indexes
  const serializedSteps = dbSteps.map((step) => {
    // Locate parent_step's position index in the dbSteps array if nested
    const parentIndex = step.parent_step_id
      ? dbSteps.findIndex((s) => s.id === step.parent_step_id)
      : null

    return {
      step_type: step.step_type,
      step_config: step.step_config || {},
      branch: step.branch || null,
      parent_index: parentIndex !== -1 ? parentIndex : null,
    }
  })

  // 4. Create a global template entry in the global_templates table
  const templatePayload = {
    name: automation.name,
    description: body.description || automation.description || 'Custom prebuilt workflow.',
    trigger_type: automation.trigger_type,
    trigger_config: automation.trigger_config || {},
    steps: serializedSteps,
  }

  const { data: newTemplate, error: insertError } = await db
    .from('global_templates')
    .insert(templatePayload)
    .select()
    .single()

  if (insertError) {
    // Graceful error if global_templates table doesn't exist yet
    if (insertError.code === '42P01') {
      return NextResponse.json(
        {
          error:
            'The global_templates database table has not been created yet. Please execute the SQL migration script (supabase/migrations/015_global_templates.sql) in your Supabase SQL Editor.',
        },
        { status: 501 }
      )
    }
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, template: newTemplate }, { status: 201 })
}
