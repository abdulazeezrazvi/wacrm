import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { runAutomationsForTrigger } from '@/lib/automations/engine'

// Lazy-initialized admin client
let _adminClient: any = null
function supabaseAdmin() {
  if (!_adminClient) {
    _adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
  }
  return _adminClient
}

interface TelegramMessage {
  message_id: number
  from: {
    id: number
    is_bot: boolean
    first_name: string
    last_name?: string
    username?: string
  }
  chat: {
    id: number
    type: 'private' | 'group' | 'supergroup' | 'channel'
    first_name?: string
    last_name?: string
    username?: string
    title?: string
  }
  date: number
  text?: string
}

interface TelegramUpdate {
  update_id: number
  message?: TelegramMessage
}

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('user_id')

    if (!userId) {
      console.warn('[telegram-webhook] Missing user_id query parameter')
      return NextResponse.json({ error: 'Missing user_id' }, { status: 400 })
    }

    const body: TelegramUpdate = await request.json()
    const message = body.message

    // Ignore non-message updates (like edits, channel posts, callbacks, etc.)
    if (!message || !message.text) {
      return NextResponse.json({ status: 'ignored' }, { status: 200 })
    }

    const chatId = message.chat.id
    const sender = message.from
    const senderName = [sender.first_name, sender.last_name].filter(Boolean).join(' ') || sender.username || `TG User ${sender.id}`
    const telegramPhoneIdentifier = `telegram:${chatId}`

    const db = supabaseAdmin()

    // 1. Find or create Contact
    const { data: contacts, error: contactError } = await db
      .from('contacts')
      .select('*')
      .eq('user_id', userId)

    if (contactError) {
      console.error('[telegram-webhook] Contact fetch error:', contactError)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    let contactRecord = contacts?.find((c: any) => c.phone === telegramPhoneIdentifier)
    let wasContactCreated = false

    if (!contactRecord) {
      const { data: newContact, error: createError } = await db
        .from('contacts')
        .insert({
          user_id: userId,
          phone: telegramPhoneIdentifier,
          name: senderName,
        })
        .select()
        .single()

      if (createError) {
        console.error('[telegram-webhook] Contact creation error:', createError)
        return NextResponse.json({ error: 'Database error' }, { status: 500 })
      }
      contactRecord = newContact
      wasContactCreated = true
    } else if (senderName && senderName !== contactRecord.name) {
      // Keep contact name in sync if changed
      await db
        .from('contacts')
        .update({ name: senderName, updated_at: new Date().toISOString() })
        .eq('id', contactRecord.id)
    }

    // 2. Find or create Conversation
    let { data: conversation, error: convError } = await db
      .from('conversations')
      .select('*')
      .eq('user_id', userId)
      .eq('contact_id', contactRecord.id)
      .maybeSingle()

    if (convError) {
      console.error('[telegram-webhook] Conversation fetch error:', convError)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    if (!conversation) {
      const { data: newConv, error: createConvError } = await db
        .from('conversations')
        .insert({
          user_id: userId,
          contact_id: contactRecord.id,
          status: 'open',
        })
        .select()
        .single()

      if (createConvError) {
        console.error('[telegram-webhook] Conversation creation error:', createConvError)
        return NextResponse.json({ error: 'Database error' }, { status: 500 })
      }
      conversation = newConv
    }

    // 3. Check if this is the first message from the contact
    const { count: priorMsgCount } = await db
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('conversation_id', conversation.id)
      .eq('sender_type', 'customer')

    const isFirstInboundMessage = (priorMsgCount ?? 0) === 0

    // 4. Insert message
    const { error: msgInsertError } = await db.from('messages').insert({
      conversation_id: conversation.id,
      sender_type: 'customer',
      content_type: 'text',
      content_text: message.text,
      message_id: `tg_${message.message_id}`,
      status: 'delivered',
      created_at: new Date(message.date * 1000).toISOString(),
    })

    if (msgInsertError) {
      console.error('[telegram-webhook] Message insert error:', msgInsertError)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    // 5. Update Conversation details
    const { error: convUpdateError } = await db
      .from('conversations')
      .update({
        last_message_text: message.text,
        last_message_at: new Date().toISOString(),
        unread_count: (conversation.unread_count || 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', conversation.id)

    if (convUpdateError) {
      console.error('[telegram-webhook] Conversation update error:', convUpdateError)
    }

    // 6. Fire Telegram triggers in background
    const triggers: ('telegram_message_received' | 'telegram_keyword_match')[] = [
      'telegram_message_received',
      'telegram_keyword_match',
    ]

    for (const triggerType of triggers) {
      runAutomationsForTrigger({
        userId,
        triggerType,
        contactId: contactRecord.id,
        context: {
          message_text: message.text,
          conversation_id: conversation.id,
        },
      }).catch((err) => {
        console.error(`[telegram-webhook] Automation trigger ${triggerType} failed:`, err)
      })
    }

    return NextResponse.json({ status: 'success' }, { status: 200 })
  } catch (error) {
    console.error('[telegram-webhook] Handler failed:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
