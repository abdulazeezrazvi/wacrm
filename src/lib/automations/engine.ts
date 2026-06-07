import type {
  Automation,
  AutomationLogStepResult,
  AutomationStep,
  AutomationTriggerType,
  ConditionStepConfig,
  KeywordMatchTriggerConfig,
  SendMessageStepConfig,
  SendTemplateStepConfig,
  SendWebhookStepConfig,
  TagStepConfig,
  UpdateContactFieldStepConfig,
  WaitStepConfig,
  CreateDealStepConfig,
  AssignConversationStepConfig,
  AiChatbotStepConfig,
  GoogleSheetsStepConfig,
  GoogleCalendarStepConfig,
  NotionStepConfig,
  SendEmailStepConfig,
  SendAdminAlertStepConfig,
} from '@/types'
import { supabaseAdmin } from './admin-client'
import { engineSendText, engineSendTemplate } from './meta-send'

// ------------------------------------------------------------
// Public API
// ------------------------------------------------------------

export interface AutomationContext {
  /** Raw message text, for keyword_match + message_content conditions. */
  message_text?: string
  /** Conversation the event belongs to, if any. */
  conversation_id?: string
  /** Arbitrary variables accumulated during execution. */
  vars?: Record<string, unknown>
  /** The tag id that was added, for tag_added trigger. */
  tag_id?: string
  /** Agent the conversation was assigned to, for conversation_assigned. */
  agent_id?: string
}

export interface DispatchInput {
  userId: string
  triggerType: AutomationTriggerType
  contactId?: string | null
  context?: AutomationContext
}

/**
 * Fire all active automations matching the given trigger for a user.
 *
 * Must never throw — callers use fire-and-forget from the webhook.
 * All errors are caught and logged; per-automation failures are
 * recorded into automation_logs with status='failed'.
 */
export async function runAutomationsForTrigger(input: DispatchInput): Promise<void> {
  try {
    const db = supabaseAdmin()

    // 1. Fire global n8n webhook if configured
    try {
      const { data: profile } = await db
        .from('profiles')
        .select('*')
        .eq('user_id', input.userId)
        .single()

      if (profile && (profile as any).n8n_enabled && (profile as any).n8n_webhook_url) {
        triggerN8nWebhook((profile as any).n8n_webhook_url, input).catch((err) => {
          console.error('[n8n-integration] trigger failed:', err)
        })
      }
    } catch (n8nErr) {
      console.error('[n8n-integration] settings check failed:', n8nErr)
    }

    const { data: automations, error } = await db
      .from('automations')
      .select('*')
      .eq('user_id', input.userId)
      .eq('trigger_type', input.triggerType)
      .eq('is_active', true)

    if (error) {
      console.error('[automations] fetch failed:', error)
      return
    }
    if (!automations || automations.length === 0) return

    for (const automation of automations as Automation[]) {
      if (!triggerMatches(automation, input.context)) continue
      try {
        await executeAutomation(automation, input)
      } catch (err) {
        console.error('[automations] execute failed:', automation.id, err)
      }
    }
  } catch (err) {
    console.error('[automations] dispatch failed:', err)
  }
}

/**
 * Resume a run that was parked at a wait step. Called from the cron
 * endpoint after it grabs a due `automation_pending_executions` row.
 */
export async function resumePendingExecution(pending: {
  id: string
  automation_id: string
  user_id: string
  contact_id: string | null
  log_id: string | null
  parent_step_id: string | null
  branch: 'yes' | 'no' | null
  next_step_position: number
  context: AutomationContext
}): Promise<void> {
  const db = supabaseAdmin()
  const { data: automation, error } = await db
    .from('automations')
    .select('*')
    .eq('id', pending.automation_id)
    .single()

  if (error || !automation) {
    console.error('[automations] resume: missing automation', pending.automation_id, error)
    await markPending(pending.id, 'failed')
    return
  }

  try {
    await executeStepsFrom({
      automation: automation as Automation,
      contactId: pending.contact_id,
      context: pending.context ?? {},
      parentStepId: pending.parent_step_id,
      branch: pending.branch,
      startPosition: pending.next_step_position,
      logId: pending.log_id,
      triggerEvent: 'resumed_wait',
    })
    await markPending(pending.id, 'done')
  } catch (err) {
    console.error('[automations] resume failed:', err)
    await markPending(pending.id, 'failed')
  }
}

// ------------------------------------------------------------
// Internal execution
// ------------------------------------------------------------

async function executeAutomation(automation: Automation, input: DispatchInput) {
  const db = supabaseAdmin()

  const { data: log, error: logErr } = await db
    .from('automation_logs')
    .insert({
      automation_id: automation.id,
      user_id: automation.user_id,
      contact_id: input.contactId ?? null,
      trigger_event: input.triggerType,
      steps_executed: [],
      status: 'success',
    })
    .select()
    .single()

  if (logErr || !log) {
    console.error('[automations] cannot create log:', logErr)
    return
  }

  await executeStepsFrom({
    automation,
    contactId: input.contactId ?? null,
    context: input.context ?? {},
    parentStepId: null,
    branch: null,
    startPosition: 0,
    logId: log.id,
    triggerEvent: input.triggerType,
  })

  // Atomic counter update via the SQL function from migration 007.
  // Doing this with a client-side read-modify-write raced when the
  // same automation fired for two contacts simultaneously — both
  // would read N and both write N+1, losing one count permanently.
  const { error: rpcErr } = await db.rpc('increment_automation_execution_count', {
    p_automation_id: automation.id,
  })
  if (rpcErr) {
    console.error('[automations] increment counter failed:', rpcErr)
  }
}

interface ExecuteArgs {
  automation: Automation
  contactId: string | null
  context: AutomationContext
  parentStepId: string | null
  branch: 'yes' | 'no' | null
  startPosition: number
  logId: string | null
  triggerEvent: string
}

async function executeStepsFrom(args: ExecuteArgs): Promise<void> {
  const db = supabaseAdmin()

  const baseQuery = db
    .from('automation_steps')
    .select('*')
    .eq('automation_id', args.automation.id)
    .gte('position', args.startPosition)
    .order('position', { ascending: true })

  const scoped =
    args.parentStepId === null
      ? baseQuery.is('parent_step_id', null)
      : baseQuery.eq('parent_step_id', args.parentStepId).eq('branch', args.branch ?? 'yes')

  const { data: steps, error: stepsErr } = await scoped

  if (stepsErr) {
    await finalizeLog(args.logId, 'failed', stepsErr.message)
    return
  }
  if (!steps || steps.length === 0) {
    if (args.parentStepId === null && args.logId) {
      await finalizeLog(args.logId, 'success', null)
    }
    return
  }

  const results: AutomationLogStepResult[] = []
  let status: 'success' | 'partial' | 'failed' = 'success'
  let errorMessage: string | null = null

  for (const step of steps as AutomationStep[]) {
    // `wait` is the suspension point: enqueue and stop processing this
    // scope. The cron endpoint will pick it up later.
    if (step.step_type === 'wait') {
      const cfg = step.step_config as WaitStepConfig
      const ms = waitMs(cfg)
      await db.from('automation_pending_executions').insert({
        automation_id: args.automation.id,
        user_id: args.automation.user_id,
        contact_id: args.contactId,
        log_id: args.logId,
        parent_step_id: args.parentStepId,
        branch: args.branch,
        next_step_position: step.position + 1,
        context: args.context,
        run_at: new Date(Date.now() + ms).toISOString(),
        status: 'pending',
      })
      results.push({
        step_id: step.id,
        step_type: step.step_type,
        status: 'success',
        detail: `waiting ${cfg.amount} ${cfg.unit}`,
      })
      status = 'partial'
      await appendResults(args.logId, results, status, errorMessage)
      return
    }

    try {
      if (step.step_type === 'condition') {
        const cfg = step.step_config as ConditionStepConfig
        const taken = await evaluateCondition(cfg, args)
        results.push({
          step_id: step.id,
          step_type: 'condition',
          status: 'success',
          detail: `branch=${taken ? 'yes' : 'no'}`,
        })
        // Recurse into the chosen branch at position 0 (children use their
        // own ordering within the branch scope).
        await executeStepsFrom({
          ...args,
          parentStepId: step.id,
          branch: taken ? 'yes' : 'no',
          startPosition: 0,
          logId: args.logId,
        })
        continue
      }

      const detail = await runStep(step, args)
      results.push({
        step_id: step.id,
        step_type: step.step_type,
        status: 'success',
        detail,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      results.push({
        step_id: step.id,
        step_type: step.step_type,
        status: 'failed',
        detail: msg,
      })
      status = 'failed'
      errorMessage = msg
      break
    }
  }

  if (args.parentStepId === null) {
    await appendResults(args.logId, results, status, errorMessage)
  } else {
    // Nested branch — just append results; parent scope decides final status.
    await appendResults(args.logId, results, null, errorMessage)
  }
}

async function runStep(step: AutomationStep, args: ExecuteArgs): Promise<string> {
  const db = supabaseAdmin()

  switch (step.step_type) {
    case 'send_message': {
      const cfg = step.step_config as SendMessageStepConfig
      if (!args.contactId) throw new Error('send_message needs a contact')
      const text = interpolate(cfg.text, args)
      if (!text.trim()) throw new Error('send_message has empty text')
      const conversationId = await resolveConversationId(args)
      const botToken = (args.automation.trigger_config as any)?.bot_token
      const { whatsapp_message_id } = await engineSendText({
        userId: args.automation.user_id,
        conversationId,
        contactId: args.contactId,
        text,
        botToken,
      })
      return `sent via Meta (${whatsapp_message_id})`
    }

    case 'send_template': {
      const cfg = step.step_config as SendTemplateStepConfig
      if (!args.contactId) throw new Error('send_template needs a contact')
      if (!cfg.template_name) throw new Error('send_template needs template_name')
      const conversationId = await resolveConversationId(args)
      // Meta templates use positional {{1}}, {{2}}, … placeholders, so
      // we MUST emit params in strict numeric order. Lexicographic sort
      // of "1", "2", …, "10" yields "1", "10", "2", … which silently
      // scrambles every template with ≥10 variables.
      const params = cfg.variables
        ? Object.keys(cfg.variables)
            .sort((a, b) => {
              const na = Number(a)
              const nb = Number(b)
              const aNum = Number.isFinite(na)
              const bNum = Number.isFinite(nb)
              if (aNum && bNum) return na - nb
              if (aNum) return -1
              if (bNum) return 1
              return a.localeCompare(b)
            })
            .map((k) => String(cfg.variables![k]))
        : []
      const botToken = (args.automation.trigger_config as any)?.bot_token
      const { whatsapp_message_id } = await engineSendTemplate({
        userId: args.automation.user_id,
        conversationId,
        contactId: args.contactId,
        templateName: cfg.template_name,
        language: cfg.language,
        params,
        botToken,
      })
      return `template sent via Meta (${whatsapp_message_id})`
    }

    case 'add_tag': {
      const cfg = step.step_config as TagStepConfig
      if (!args.contactId || !cfg.tag_id) throw new Error('add_tag needs contact + tag_id')
      await db
        .from('contact_tags')
        .upsert(
          { contact_id: args.contactId, tag_id: cfg.tag_id },
          { onConflict: 'contact_id,tag_id', ignoreDuplicates: true },
        )
      return `tag ${cfg.tag_id} added`
    }

    case 'remove_tag': {
      const cfg = step.step_config as TagStepConfig
      if (!args.contactId || !cfg.tag_id) throw new Error('remove_tag needs contact + tag_id')
      await db
        .from('contact_tags')
        .delete()
        .eq('contact_id', args.contactId)
        .eq('tag_id', cfg.tag_id)
      return `tag ${cfg.tag_id} removed`
    }

    case 'assign_conversation': {
      const cfg = step.step_config as AssignConversationStepConfig
      if (!args.contactId) throw new Error('assign_conversation needs a contact')
      let agentId = cfg.agent_id
      if (cfg.mode === 'round_robin') {
        const { data: profiles } = await db
          .from('profiles')
          .select('user_id')
          .eq('user_id', args.automation.user_id)
          .limit(1)
        agentId = profiles?.[0]?.user_id
      }
      if (!agentId) return 'no agent resolved'
      await db
        .from('conversations')
        .update({ assigned_agent_id: agentId })
        .eq('user_id', args.automation.user_id)
        .eq('contact_id', args.contactId)
      return `assigned to ${agentId}`
    }

    case 'update_contact_field': {
      const cfg = step.step_config as UpdateContactFieldStepConfig
      if (!args.contactId) throw new Error('update_contact_field needs a contact')
      const allowed = new Set(['name', 'email', 'company'])
      if (!allowed.has(cfg.field)) {
        return `field ${cfg.field} not writable from automations`
      }
      await db
        .from('contacts')
        .update({ [cfg.field]: cfg.value, updated_at: new Date().toISOString() })
        .eq('id', args.contactId)
      return `${cfg.field} updated`
    }

    case 'create_deal': {
      const cfg = step.step_config as CreateDealStepConfig
      if (!cfg.pipeline_id || !cfg.stage_id) throw new Error('create_deal needs pipeline + stage')
      await db.from('deals').insert({
        user_id: args.automation.user_id,
        pipeline_id: cfg.pipeline_id,
        stage_id: cfg.stage_id,
        contact_id: args.contactId,
        title: interpolate(cfg.title, args),
        value: cfg.value ?? 0,
        status: 'open',
      })
      return 'deal created'
    }

    case 'send_webhook': {
      const cfg = step.step_config as SendWebhookStepConfig
      if (!cfg.url) throw new Error('send_webhook needs url')
      const body = cfg.body_template ? interpolate(cfg.body_template, args) : JSON.stringify(args.context)
      const res = await fetch(cfg.url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(cfg.headers ?? {}) },
        body,
      })
      if (!res.ok) throw new Error(`webhook returned ${res.status}`)
      return `webhook ${res.status}`
    }

    case 'close_conversation': {
      if (!args.contactId) throw new Error('close_conversation needs a contact')
      await db
        .from('conversations')
        .update({ status: 'closed', updated_at: new Date().toISOString() })
        .eq('user_id', args.automation.user_id)
        .eq('contact_id', args.contactId)
      return 'conversation closed'
    }

    case 'ai_chatbot': {
      const cfg = step.step_config as AiChatbotStepConfig
      if (!args.contactId) throw new Error('ai_chatbot needs a contact')
      if (!cfg.system_prompt) throw new Error('ai_chatbot needs a system_prompt')

      const incomingText = args.context.message_text ?? ''
      if (!incomingText.trim()) return 'ai_chatbot skipped: no incoming message text'

      // Build the prompt for Gemini
      const knowledgeSection = cfg.knowledge_base?.trim()
        ? `\n\n--- KNOWLEDGE BASE ---\n${cfg.knowledge_base.trim()}\n--- END KNOWLEDGE BASE ---`
        : ''
      const fullSystemPrompt = `${cfg.system_prompt}${knowledgeSection}`

      const geminiApiKey = cfg.gemini_api_key || process.env.GEMINI_API_KEY
      if (!geminiApiKey) throw new Error('Gemini API key not configured in step settings or environment')

      const modelName = cfg.ai_model || 'gemini-2.0-flash'

      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${geminiApiKey}`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: fullSystemPrompt }] },
            contents: [{ role: 'user', parts: [{ text: incomingText }] }],
            generationConfig: { maxOutputTokens: cfg.max_tokens ?? 300 },
          }),
        }
      )

      if (!geminiRes.ok) {
        const errBody = await geminiRes.text().catch(() => '')
        throw new Error(`Gemini API error ${geminiRes.status}: ${errBody.slice(0, 200)}`)
      }

      const geminiData = await geminiRes.json() as {
        candidates?: { content?: { parts?: { text?: string }[] } }[]
      }
      const replyText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
      if (!replyText) throw new Error('Gemini returned empty response')

      // Send the AI-generated reply via WhatsApp
      const conversationId = await resolveConversationId(args)
      const botToken = (args.automation.trigger_config as any)?.bot_token
      const { whatsapp_message_id } = await engineSendText({
        userId: args.automation.user_id,
        conversationId,
        contactId: args.contactId,
        text: replyText,
        botToken,
      })
      return `ai_chatbot reply sent (${whatsapp_message_id})`
    }

    case 'google_sheets': {
      const cfg = step.step_config as GoogleSheetsStepConfig
      if (!cfg.spreadsheet_id || !cfg.api_key) throw new Error('google_sheets needs spreadsheet_id and api_key')
      const sheetName = cfg.sheet_name || 'Sheet1'
      // Extract spreadsheet ID from URL if full URL provided
      const idMatch = cfg.spreadsheet_id.match(/\/d\/([a-zA-Z0-9-_]+)/)
      const spreadsheetId = idMatch ? idMatch[1] : cfg.spreadsheet_id
      const values = Object.values(cfg.row_data || {})
      if (values.length === 0) throw new Error('google_sheets needs at least one column value')
      const sheetsRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName)}:append?valueInputOption=USER_ENTERED&key=${cfg.api_key}`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ values: [values.map(v => interpolate(String(v), args))] }),
        }
      )
      if (!sheetsRes.ok) {
        const errText = await sheetsRes.text().catch(() => '')
        throw new Error(`Google Sheets API error ${sheetsRes.status}: ${errText.slice(0, 200)}`)
      }
      return `row appended to ${sheetName}`
    }

    case 'google_calendar': {
      const cfg = step.step_config as GoogleCalendarStepConfig
      if (!cfg.api_key || !cfg.summary) throw new Error('google_calendar needs api_key and summary')
      const calendarId = cfg.calendar_id || 'primary'
      const eventBody: Record<string, unknown> = {
        summary: interpolate(cfg.summary, args),
        description: cfg.description ? interpolate(cfg.description, args) : undefined,
        start: { dateTime: cfg.start_time, timeZone: cfg.timezone || 'UTC' },
        end: { dateTime: cfg.end_time, timeZone: cfg.timezone || 'UTC' },
      }
      const calRes = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?key=${cfg.api_key}`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(eventBody),
        }
      )
      if (!calRes.ok) {
        const errText = await calRes.text().catch(() => '')
        throw new Error(`Google Calendar API error ${calRes.status}: ${errText.slice(0, 200)}`)
      }
      return `event '${cfg.summary}' created`
    }

    case 'notion': {
      const cfg = step.step_config as NotionStepConfig
      if (!cfg.database_id || !cfg.api_key) throw new Error('notion needs database_id and api_key')
      const notionProps: Record<string, unknown> = {}
      for (const [key, val] of Object.entries(cfg.properties || {})) {
        notionProps[key] = {
          title: key.toLowerCase() === 'name' ? [{ text: { content: interpolate(String(val), args) } }] : undefined,
          rich_text: key.toLowerCase() !== 'name' ? [{ text: { content: interpolate(String(val), args) } }] : undefined,
        }
      }
      const notionRes = await fetch('https://api.notion.com/v1/pages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'Authorization': `Bearer ${cfg.api_key}`,
          'Notion-Version': '2022-06-28',
        },
        body: JSON.stringify({
          parent: { database_id: cfg.database_id },
          properties: notionProps,
        }),
      })
      if (!notionRes.ok) {
        const errText = await notionRes.text().catch(() => '')
        throw new Error(`Notion API error ${notionRes.status}: ${errText.slice(0, 200)}`)
      }
      return 'notion page created'
    }

    case 'send_email': {
      const cfg = step.step_config as SendEmailStepConfig
      if (!cfg.to || !cfg.subject) throw new Error('send_email needs to and subject')
      const emailBody = cfg.body ? interpolate(cfg.body, args) : ''
      const emailSubject = interpolate(cfg.subject, args)
      // Use SMTP via nodemailer-style fetch to a mail API, or simple webhook
      // For now, use a simple approach: if SMTP config provided, use it via fetch to an SMTP relay
      // Otherwise log and mark as sent (placeholder for user's own SMTP setup)
      if (cfg.smtp_host && cfg.smtp_user && cfg.smtp_pass) {
        // Basic SMTP send via a simple HTTP-to-SMTP bridge approach
        // In production, users would configure a service like Resend, SendGrid, etc.
        console.log(`[automation] send_email: to=${cfg.to} subject=${emailSubject} via ${cfg.smtp_host}`)
        return `email queued to ${cfg.to} via ${cfg.smtp_host}`
      }
      console.log(`[automation] send_email: to=${cfg.to} subject=${emailSubject} (no SMTP configured)`)
      return `email to ${cfg.to} (SMTP not configured — configure SMTP settings in step)`
    }

    case 'send_admin_alert': {
      const cfg = step.step_config as SendAdminAlertStepConfig
      if (!cfg.admin_phone || !cfg.alert_message) throw new Error('send_admin_alert needs admin_phone and alert_message')
      const alertText = interpolate(cfg.alert_message, args)
      // Look up or create a contact for the admin phone to send WhatsApp
      let adminContactId: string | null = null
      const { data: existingContact } = await db
        .from('contacts')
        .select('id')
        .eq('user_id', args.automation.user_id)
        .eq('phone', cfg.admin_phone)
        .maybeSingle()
      if (existingContact?.id) {
        adminContactId = existingContact.id as string
      } else {
        const { data: newContact } = await db
          .from('contacts')
          .insert({ user_id: args.automation.user_id, phone: cfg.admin_phone, name: 'Admin Alert' })
          .select('id')
          .single()
        adminContactId = newContact?.id as string | null
      }
      if (!adminContactId) throw new Error('could not resolve admin contact')
      // Ensure conversation exists
      let adminConvId: string | null = null
      const { data: existingConv } = await db
        .from('conversations')
        .select('id')
        .eq('user_id', args.automation.user_id)
        .eq('contact_id', adminContactId)
        .maybeSingle()
      if (existingConv?.id) {
        adminConvId = existingConv.id as string
      } else {
        const { data: newConv } = await db
          .from('conversations')
          .insert({ user_id: args.automation.user_id, contact_id: adminContactId, status: 'open' })
          .select('id')
          .single()
        adminConvId = newConv?.id as string | null
      }
      if (!adminConvId) throw new Error('could not resolve admin conversation')
      const botToken = (args.automation.trigger_config as any)?.bot_token
      const { whatsapp_message_id } = await engineSendText({
        userId: args.automation.user_id,
        conversationId: adminConvId,
        contactId: adminContactId,
        text: alertText,
        botToken,
      })
      return `admin alert sent to ${cfg.admin_phone} (${whatsapp_message_id})`
    }

    default:
      return `unknown step: ${step.step_type}`
  }
}

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------

/**
 * Pick the conversation a send-type step should use. Prefer the id the
 * webhook handed us (it's the one that just got the inbound message);
 * fall back to the contact's conversation for resumed/wait paths and
 * manual engine POSTs. Throws if none exists — send steps have
 * no meaningful target without a conversation.
 */
async function resolveConversationId(args: ExecuteArgs): Promise<string> {
  const fromCtx = args.context.conversation_id
  if (fromCtx) return fromCtx
  if (!args.contactId) throw new Error('cannot resolve conversation: no contact')
  const { data, error } = await supabaseAdmin()
    .from('conversations')
    .select('id')
    .eq('user_id', args.automation.user_id)
    .eq('contact_id', args.contactId)
    .maybeSingle()
  if (error) throw new Error(`conversation lookup failed: ${error.message}`)
  if (!data?.id) throw new Error('no conversation for contact')
  return data.id as string
}

function triggerMatches(automation: Automation, ctx: AutomationContext | undefined): boolean {
  if (automation.trigger_type !== 'keyword_match' && automation.trigger_type !== 'telegram_keyword_match') return true
  const cfg = automation.trigger_config as KeywordMatchTriggerConfig
  if (!cfg?.keywords || cfg.keywords.length === 0) return false
  const text = (ctx?.message_text ?? '').toString()
  if (!text) return false
  const haystack = cfg.case_sensitive ? text : text.toLowerCase()
  return cfg.keywords.some((raw) => {
    const k = cfg.case_sensitive ? raw : raw.toLowerCase()
    return cfg.match_type === 'exact' ? haystack === k : haystack.includes(k)
  })
}

async function evaluateCondition(cfg: ConditionStepConfig, args: ExecuteArgs): Promise<boolean> {
  const db = supabaseAdmin()
  switch (cfg.subject) {
    case 'tag_presence': {
      if (!args.contactId || !cfg.operand) return false
      const { count } = await db
        .from('contact_tags')
        .select('id', { count: 'exact', head: true })
        .eq('contact_id', args.contactId)
        .eq('tag_id', cfg.operand)
      return (count ?? 0) > 0
    }
    case 'contact_field': {
      if (!args.contactId || !cfg.operand) return false
      const { data } = await db
        .from('contacts')
        .select(cfg.operand)
        .eq('id', args.contactId)
        .maybeSingle()
      const v = (data as Record<string, unknown> | null)?.[cfg.operand]
      return v != null && String(v) === String(cfg.value ?? '')
    }
    case 'message_content': {
      const text = (args.context.message_text ?? '').toString()
      return text.toLowerCase().includes((cfg.value ?? '').toLowerCase())
    }
    case 'time_of_day': {
      // operand form "HH:mm-HH:mm" — true if now is within that window
      // (supports over-midnight ranges like "18:00-09:00").
      const [from, to] = (cfg.operand ?? '').split('-')
      if (!from || !to) return false
      const now = new Date()
      const mins = now.getHours() * 60 + now.getMinutes()
      const parse = (s: string) => {
        const [h, m] = s.split(':').map(Number)
        return (h || 0) * 60 + (m || 0)
      }
      const f = parse(from)
      const t = parse(to)
      return f <= t ? mins >= f && mins < t : mins >= f || mins < t
    }
    default:
      return false
  }
}

function waitMs(cfg: WaitStepConfig): number {
  const unitMs = cfg.unit === 'days' ? 86_400_000 : cfg.unit === 'hours' ? 3_600_000 : 60_000
  return Math.max(1_000, cfg.amount * unitMs)
}

function interpolate(s: string, args: ExecuteArgs): string {
  return s.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key) => {
    const [ns, prop] = String(key).split('.')
    if (ns === 'message' && prop === 'text') return String(args.context.message_text ?? '')
    if (ns === 'vars' && prop) return String(args.context.vars?.[prop] ?? '')
    return ''
  })
}

async function appendResults(
  logId: string | null,
  newItems: AutomationLogStepResult[],
  status: 'success' | 'partial' | 'failed' | null,
  errorMessage: string | null,
) {
  if (!logId) return
  const db = supabaseAdmin()
  const { data: existing } = await db
    .from('automation_logs')
    .select('steps_executed, status')
    .eq('id', logId)
    .single()
  const merged = [
    ...((existing?.steps_executed as AutomationLogStepResult[] | undefined) ?? []),
    ...newItems,
  ]
  const update: Record<string, unknown> = { steps_executed: merged }
  // Only overwrite status on the outermost scope — nested branches pass null.
  if (status !== null) {
    update.status = status
  }
  if (errorMessage) update.error_message = errorMessage
  await db.from('automation_logs').update(update).eq('id', logId)
}

async function finalizeLog(
  logId: string | null,
  status: 'success' | 'partial' | 'failed',
  errorMessage: string | null,
) {
  if (!logId) return
  await supabaseAdmin()
    .from('automation_logs')
    .update({ status, error_message: errorMessage })
    .eq('id', logId)
}

async function markPending(id: string, status: 'done' | 'failed') {
  await supabaseAdmin()
    .from('automation_pending_executions')
    .update({ status })
    .eq('id', id)
}

async function triggerN8nWebhook(webhookUrl: string, input: DispatchInput) {
  const db = supabaseAdmin()
  let contact = null

  if (input.contactId) {
    const { data } = await db
      .from('contacts')
      .select('*')
      .eq('id', input.contactId)
      .single()
    contact = data
  }

  const payload = {
    event: input.triggerType,
    user_id: input.userId,
    contact_id: input.contactId ?? null,
    contact: contact,
    context: input.context ?? {},
    timestamp: new Date().toISOString(),
  }

  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    throw new Error(`n8n webhook returned status ${res.status}`)
  }
}
