import type {
  AutomationStepConfig,
  AutomationStepType,
  AutomationTriggerConfig,
  AutomationTriggerType,
} from '@/types'

export type TemplateSlug =
  | 'welcome_message'
  | 'out_of_office'
  | 'lead_qualifier'
  | 'follow_up_reminder'
  | 'appointment_booking'
  | 'support_escalator'
  | 'lead_reactivation'
  | 'lead_generation'
  | 'aria_agency_assistant'

export interface TemplateStepSeed {
  step_type: AutomationStepType
  step_config: AutomationStepConfig
  branch?: 'yes' | 'no' | null
  /** Index (within this seed list) of the Condition parent, if nested. */
  parent_index?: number | null
}

export interface AutomationTemplateDefinition {
  slug: TemplateSlug
  name: string
  description: string
  trigger_type: AutomationTriggerType
  trigger_config: AutomationTriggerConfig
  steps: TemplateStepSeed[]
}

export const AUTOMATION_TEMPLATES: Record<TemplateSlug, AutomationTemplateDefinition> = {
  welcome_message: {
    slug: 'welcome_message',
    name: 'Welcome Message',
    description: 'Auto-reply to first-time contacts with a greeting.',
    trigger_type: 'first_inbound_message',
    trigger_config: {},
    steps: [
      {
        step_type: 'send_message',
        step_config: {
          text: "Hi! 👋 Thanks for reaching out. We'll get back to you shortly.",
        },
      },
      {
        step_type: 'add_tag',
        step_config: { tag_id: '' },
      },
    ],
  },
  out_of_office: {
    slug: 'out_of_office',
    name: 'Out of Office',
    description: 'Auto-reply during off-hours so nobody is left waiting.',
    trigger_type: 'new_message_received',
    trigger_config: {},
    steps: [
      {
        step_type: 'condition',
        step_config: {
          subject: 'time_of_day',
          operand: '18:00-09:00',
        },
      },
      {
        step_type: 'send_message',
        step_config: {
          text:
            "Thanks for your message! Our team is offline right now (9am–6pm) and will reply first thing tomorrow.",
        },
        parent_index: 0,
        branch: 'yes',
      },
    ],
  },
  lead_qualifier: {
    slug: 'lead_qualifier',
    name: 'Lead Qualifier',
    description: 'Ask qualification questions to filter inbound leads.',
    trigger_type: 'keyword_match',
    trigger_config: {
      keywords: ['pricing', 'quote', 'buy'],
      match_type: 'contains',
    },
    steps: [
      {
        step_type: 'send_message',
        step_config: {
          text:
            "Great — happy to help with pricing! Quick question: roughly how many seats are you looking for?",
        },
      },
      {
        step_type: 'wait',
        step_config: { amount: 10, unit: 'minutes' },
      },
      {
        step_type: 'assign_conversation',
        step_config: { mode: 'round_robin' },
      },
    ],
  },
  follow_up_reminder: {
    slug: 'follow_up_reminder',
    name: 'Follow-up Reminder',
    description: 'Send a nudge if a contact has not replied within 24 hours.',
    trigger_type: 'new_message_received',
    trigger_config: {},
    steps: [
      {
        step_type: 'wait',
        step_config: { amount: 1, unit: 'days' },
      },
      {
        step_type: 'send_message',
        step_config: {
          text:
            "Just circling back — did you have any other questions for us? Happy to help!",
        },
      },
    ],
  },
  appointment_booking: {
    slug: 'appointment_booking',
    name: 'AI Appointment Booking & Lead Router',
    description: 'AI chatbot qualifies interest, schedules bookings, and inserts details into the CRM pipeline.',
    trigger_type: 'new_message_received',
    trigger_config: {},
    steps: [
      {
        step_type: 'ai_chatbot',
        step_config: {
          system_prompt: 'You are a scheduling chatbot. Your goal is to guide the user to schedule a consultation. Ask for their Name, Email, and Preferred date/time. Be warm, concise, and helpful.',
          knowledge_base: 'Consultations are free, last 30 minutes, and are conducted via Google Meet. Available times: Mon-Fri 9am-5pm.',
          max_tokens: 300,
          ai_model: 'gemini-2.0-flash',
        },
      },
      {
        step_type: 'create_deal',
        step_config: {
          pipeline_id: '', // Automatically pre-filled client-side with user default pipeline
          stage_id: '',    // Automatically pre-filled client-side with user default stage
          title: 'AI Scheduled Consultation',
          value: 500,
        },
      },
    ],
  },
  support_escalator: {
    slug: 'support_escalator',
    name: 'AI Support Assistant & Escalator',
    description: 'AI manages queries. Upset customers or refund requests are escalated to human agents.',
    trigger_type: 'new_message_received',
    trigger_config: {},
    steps: [
      {
        step_type: 'condition',
        step_config: {
          subject: 'message_content',
          operand: 'angry, upset, issue, problem, support, human, refund, cancel',
        },
      },
      {
        step_type: 'send_message',
        step_config: {
          text: "I'm so sorry to hear that. I am transferring you to a human specialist who will help you immediately.",
        },
        parent_index: 0,
        branch: 'yes',
      },
      {
        step_type: 'create_deal',
        step_config: {
          pipeline_id: '',
          stage_id: '',
          title: '⚠️ Urgent Support Escalation',
          value: 0,
        },
        parent_index: 0,
        branch: 'yes',
      },
      {
        step_type: 'assign_conversation',
        step_config: {
          mode: 'round_robin',
        },
        parent_index: 0,
        branch: 'yes',
      },
      {
        step_type: 'ai_chatbot',
        step_config: {
          system_prompt: 'You are a customer support agent. Answer the customer queries politely and professionally using the knowledge base.',
          knowledge_base: 'Return policy: 14 days. Subscriptions renew monthly and can be canceled anytime under Settings.',
          max_tokens: 250,
          ai_model: 'gemini-2.0-flash',
        },
        parent_index: 0,
        branch: 'no',
      },
    ],
  },
  lead_reactivation: {
    slug: 'lead_reactivation',
    name: 'AI Lead Reactivation Campaign',
    description: 'Wait 3 days after lead creation, then trigger AI to reactivate cold leads with promo campaigns.',
    trigger_type: 'new_contact_created',
    trigger_config: {},
    steps: [
      {
        step_type: 'wait',
        step_config: {
          amount: 3,
          unit: 'days',
        },
      },
      {
        step_type: 'ai_chatbot',
        step_config: {
          system_prompt: 'Reach out to the contact, politely follow up, and offer them a limited-time 20% discount code if they schedule a CRM consultation today.',
          knowledge_base: 'Promo code: CRM20. Booking link: cal.com/crm-demo.',
          max_tokens: 300,
          ai_model: 'gemini-2.0-flash',
        },
      },
    ],
  },
  lead_generation: {
    slug: 'lead_generation',
    name: 'AI Lead Capture & Contact Generator',
    description: 'Greets first-time contacts, captures Name/Email/Company, and registers them in the CRM pipeline.',
    trigger_type: 'first_inbound_message',
    trigger_config: {},
    steps: [
      {
        step_type: 'ai_chatbot',
        step_config: {
          system_prompt: 'Ask the user for their Name, Email address, and Company name. Be polite, welcoming, and direct. Once collected, thank them.',
          knowledge_base: 'This is a WhatsApp CRM automation platform.',
          max_tokens: 200,
          ai_model: 'gemini-2.0-flash',
        },
      },
      {
        step_type: 'add_tag',
        step_config: {
          tag_id: '',
        },
      },
      {
        step_type: 'create_deal',
        step_config: {
          pipeline_id: '',
          stage_id: '',
          title: 'AI Captured Lead',
          value: 100,
        },
      },
    ],
  },
  aria_agency_assistant: {
    slug: 'aria_agency_assistant',
    name: 'Aria AI Agency Assistant',
    description: 'Deploys Aria, the AI agency assistant, to qualify leads, book calls, and route customer requests for BK Nuxes.',
    trigger_type: 'new_message_received',
    trigger_config: {},
    steps: [
      {
        step_type: 'ai_chatbot',
        step_config: {
          system_prompt: `You are Aria, the AI assistant for BK Nuxes. You operate inside WaCRM and handle all inbound conversations on behalf of the agency. You are a professional business assistant. Greet leads warmly but keep messages under 3 lines.
Working hours: Mon–Sat, 9 AM – 7 PM IST. Owner: Abdul Azeez. Owner WhatsApp: 9741366349.

SERVICES YOU SELL (Live preview built on short call):
1. Admin Dashboard (₹12k + ₹1.5k/mo) - operations/inventory/reports.
2. Landing Page (₹5k + ₹800/mo) - local business lead capture.
3. E-commerce Store (₹18k + ₹2.5k/mo) - online store with WhatsApp integration.

CONVERSATION STATES & SCRIPTS:
- NEW_LEAD: Ask: "What kind of business do you run?" Then ask: "Do you have a website or building from scratch?" Then ask: "What's the main goal (customers, operations, online sales)?" Then book a call.
- QUALIFIED_LEAD: Ask to confirm their phone for booking a 10-minute preview call. Trigger scheduler when confirmed.
- EXISTING_CUSTOMER: Greet by name and route: updates (WF3), billing (WF4), down/error (immediate escalation), upsell (describe/price/call), cancellation/anger (immediate escalation).

LANGUAGE & TONE: Match customer's language (Hindi, Hinglish, English). NEVER use filler phrases. Never mention internal tech (Vapi, Supabase).
ESCALATION: Send alert to owner if angry, cancellation, site down, or hot lead ready to pay.`,
          knowledge_base: 'BK Nuxes: Location: Davanagere, Karnataka. Phone: 9741366349. Email: info@bknuxes.local.',
          max_tokens: 350,
          ai_model: 'gemini-2.0-flash',
        },
      },
    ],
  },
}

export function getTemplate(slug: string): AutomationTemplateDefinition | null {
  return AUTOMATION_TEMPLATES[slug as TemplateSlug] ?? null
}
