import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

/**
 * POST /api/admin/seed
 *
 * One-time bootstrap route that creates the default admin account
 * if it doesn't already exist. Protected by checking if any admin
 * profile already exists — once one does, this route becomes a no-op.
 *
 * Default admin credentials:
 *   Email:    admin@wacrm.local
 *   Password: Admin@123456
 */

const ADMIN_EMAIL = 'abdulazeezrazvi125@gmail.com'
const ADMIN_PASSWORD = 'Admin@123456'
const ADMIN_FULL_NAME = 'CRM Admin'

export async function POST() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { error: 'Missing Supabase environment variables' },
      { status: 500 },
    )
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Check if an admin profile already exists
  const { data: existingAdmin } = await admin
    .from('profiles')
    .select('id')
    .eq('role', 'admin')
    .limit(1)
    .maybeSingle()

  if (existingAdmin) {
    return NextResponse.json({
      message: 'Admin account already exists. No action taken.',
      seeded: false,
    })
  }

  // Create the auth user via the admin API (bypasses email confirmation)
  const { data: authData, error: authError } =
    await admin.auth.admin.createUser({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: ADMIN_FULL_NAME },
    })

  let userId: string | null = null

  if (authError) {
    // If the auth user already exists, attempt to find their profile to promote them to admin
    const isAlreadyExists = 
      authError.message.toLowerCase().includes('already exists') || 
      authError.message.toLowerCase().includes('already registered') || 
      authError.status === 422;

    if (isAlreadyExists) {
      const { data: profileData } = await admin
        .from('profiles')
        .select('user_id')
        .eq('email', ADMIN_EMAIL)
        .maybeSingle()

      if (profileData?.user_id) {
        userId = profileData.user_id
      } else {
        return NextResponse.json(
          { error: `Admin user already exists in auth.users, but no profile row was found. Verify your database triggers are working.` },
          { status: 500 },
        )
      }
    } else {
      return NextResponse.json(
        { error: `Failed to create admin auth user: ${authError.message}` },
        { status: 500 },
      )
    }
  } else {
    userId = authData.user.id
  }

  // Update it to 'admin'.
  const { error: updateError } = await admin
    .from('profiles')
    .update({ role: 'admin' })
    .eq('user_id', userId)

  if (updateError) {
    return NextResponse.json(
      { error: `Admin user found/created but role update failed: ${updateError.message}` },
      { status: 500 },
    )
  }

  return NextResponse.json({
    message: 'Admin account created successfully.',
    seeded: true,
    credentials: {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    },
  })
}
