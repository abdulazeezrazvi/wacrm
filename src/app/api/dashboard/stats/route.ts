import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  loadActivity,
  loadConversationsSeries,
  loadMetrics,
  loadPipelineDonut,
  loadResponseTime,
} from '@/lib/dashboard/queries'

export async function GET() {
  try {
    const db = await createClient()

    // Authenticate the user server-side using getUser()
    const { data: { user }, error: authError } = await db.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Execute all queries in parallel.
    // By pre-fetching 7, 30, and 90 day series, we can enable
    // instantaneous tab-switching on the client.
    const [
      metrics,
      series7,
      series30,
      series90,
      pipeline,
      responseTime,
      activity,
    ] = await Promise.all([
      loadMetrics(db),
      loadConversationsSeries(db, 7),
      loadConversationsSeries(db, 30),
      loadConversationsSeries(db, 90),
      loadPipelineDonut(db),
      loadResponseTime(db),
      loadActivity(db, 50),
    ])

    return NextResponse.json({
      metrics,
      series: {
        7: series7,
        30: series30,
        90: series90,
      },
      pipeline,
      responseTime,
      activity,
    })
  } catch (error: any) {
    console.error('[api/dashboard/stats] failed:', error)
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    )
  }
}
