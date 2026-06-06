'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  MessageSquare,
  Zap,
  GitBranch,
  Bot,
  Users,
  BarChart3,
  Check,
  ChevronRight,
  Star,
  Shield,
  Webhook,
  Radio,
  Tag,
  Briefcase,
  ArrowRight,
  Menu,
  X,
  Sparkles,
  Globe,
  Lock,
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────
interface SaasSettings {
  starter_price: number
  pro_price: number
  free_code: string
  discount_code: string
  discount_percentage: number
}

// ─── Data ────────────────────────────────────────────────────────────────────
const FEATURES = [
  {
    icon: MessageSquare,
    title: 'WhatsApp Inbox',
    description: 'Manage all your customer conversations in one unified inbox. Assign, reply, and resolve — faster than ever.',
    color: 'from-violet-500 to-purple-600',
  },
  {
    icon: Bot,
    title: 'AI Chatbot Automation',
    description: 'Let Gemini AI handle routine queries 24/7. Configure your persona, inject your knowledge base, and watch it respond intelligently.',
    color: 'from-emerald-500 to-teal-600',
  },
  {
    icon: GitBranch,
    title: 'Visual Automation Builder',
    description: 'Build complex multi-step workflows with a drag-and-drop canvas. Triggers, conditions, waits — all without code.',
    color: 'from-amber-500 to-orange-600',
  },
  {
    icon: Users,
    title: 'Contact CRM',
    description: 'Store rich customer profiles, custom fields, tags, and notes. Every interaction captured, nothing forgotten.',
    color: 'from-blue-500 to-cyan-600',
  },
  {
    icon: Briefcase,
    title: 'Sales Pipelines',
    description: 'Track deals from lead to close with visual Kanban boards. Auto-create deals when contacts message you.',
    color: 'from-rose-500 to-pink-600',
  },
  {
    icon: Radio,
    title: 'Bulk Broadcasts',
    description: 'Send WhatsApp template campaigns to thousands of contacts. Track delivery, read rates, and replies in real time.',
    color: 'from-indigo-500 to-violet-600',
  },
  {
    icon: Webhook,
    title: 'n8n & Webhook Integration',
    description: 'Connect CRM for WhatsApp to any tool via webhook actions. Pipe data to n8n, Zapier, Make, or your own backend.',
    color: 'from-slate-500 to-slate-600',
  },
  {
    icon: BarChart3,
    title: 'Analytics Dashboard',
    description: 'Get a birds-eye view of your business: messages, deals, conversion rates, and automation performance.',
    color: 'from-yellow-500 to-amber-600',
  },
]

const TESTIMONIALS = [
  {
    name: 'Arjun Mehta',
    role: 'Founder, QuickFix Services',
    avatar: 'AM',
    stars: 5,
    text: 'CRM for WhatsApp completely transformed how we handle customer support. The AI chatbot handles 70% of queries automatically!',
  },
  {
    name: 'Priya Sharma',
    role: 'Head of Sales, TechLeap India',
    avatar: 'PS',
    stars: 5,
    text: 'The automation builder is incredible. We set up a full lead nurturing sequence in 20 minutes. Our conversion rate jumped 40%.',
  },
  {
    name: 'Rohan Gupta',
    role: 'CEO, UrbanCart',
    avatar: 'RG',
    stars: 5,
    text: 'Best WhatsApp CRM we have used. Pipelines + broadcasts + automations in one tool. The INR pricing is fair and transparent.',
  },
]

const FAQS = [
  {
    q: 'Do I need a WhatsApp Business API account?',
    a: 'Yes. You need a Meta-approved WhatsApp Business API number. We guide you through setup after signup — it typically takes 1–3 business days.',
  },
  {
    q: 'How does the 1-month free trial work?',
    a: 'After signup you get 30 days of full access to all features. No credit card required upfront. At the end of trial you can subscribe to Starter or Pro.',
  },
  {
    q: 'Can I enter a promo / lifetime code?',
    a: 'Yes! During signup enter your promo code. A lifetime free code gives you permanent free access. A discount code gives a percentage off your subscription.',
  },
  {
    q: 'Is my data safe?',
    a: 'Absolutely. All data is stored in a PostgreSQL database with row-level security. Each user can only access their own data. We use Supabase and follow industry best practices.',
  },
  {
    q: 'Can I connect to n8n or Zapier?',
    a: 'Yes. Use the Send Webhook automation step to POST contact/message data to any endpoint — including n8n webhooks, Zapier, Make, or your own API.',
  },
]

// ─── Promo Code Widget ────────────────────────────────────────────────────────
function PromoCodeWidget({ settings }: { settings: SaasSettings | null }) {
  const [code, setCode] = useState('')
  const [result, setResult] = useState<{ type: 'success' | 'error' | 'discount'; msg: string } | null>(null)

  function applyCode() {
    if (!settings) return
    const trimmed = code.trim().toUpperCase()
    if (!trimmed) return

    if (settings.free_code && trimmed === settings.free_code.toUpperCase()) {
      setResult({ type: 'success', msg: '🎉 Lifetime free access! Sign up and enter this code to unlock permanent free access.' })
    } else if (settings.discount_code && trimmed === settings.discount_code.toUpperCase()) {
      const discounted = Math.round((settings.starter_price * (100 - settings.discount_percentage)) / 100)
      setResult({
        type: 'discount',
        msg: `🏷️ ${settings.discount_percentage}% off applied! Starter becomes ₹${discounted}/mo. Enter code at signup.`,
      })
    } else {
      setResult({ type: 'error', msg: '❌ Invalid code. Check the code and try again.' })
    }
  }

  return (
    <div className="mx-auto max-w-md rounded-2xl border border-slate-700/60 bg-slate-900/80 p-5 backdrop-blur-xl">
      <p className="mb-3 text-center text-sm font-medium text-slate-300">
        Have a promo or lifetime code?
      </p>
      <div className="flex gap-2">
        <input
          value={code}
          onChange={(e) => { setCode(e.target.value.toUpperCase()); setResult(null) }}
          onKeyDown={(e) => e.key === 'Enter' && applyCode()}
          placeholder="e.g. LIFETIMEFREE"
          className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 font-mono text-sm text-white placeholder:text-slate-500 focus:border-violet-500 focus:outline-none"
        />
        <button
          onClick={applyCode}
          className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-700"
        >
          Apply
        </button>
      </div>
      {result && (
        <p className={`mt-3 rounded-lg px-3 py-2 text-sm ${
          result.type === 'error'
            ? 'bg-rose-500/10 text-rose-400'
            : result.type === 'discount'
            ? 'bg-amber-500/10 text-amber-400'
            : 'bg-emerald-500/10 text-emerald-400'
        }`}>
          {result.msg}
        </p>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function LandingPage() {
  const [settings, setSettings] = useState<SaasSettings | null>(null)
  const [navOpen, setNavOpen] = useState(false)
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const pricingRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('saas_settings')
      .select('starter_price,pro_price,free_code,discount_code,discount_percentage')
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setSettings(data as SaasSettings)
      })
  }, [])

  const starterPrice = settings?.starter_price ?? 499
  const proPrice = settings?.pro_price ?? 999

  function scrollToPricing() {
    pricingRef.current?.scrollIntoView({ behavior: 'smooth' })
    setNavOpen(false)
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white selection:bg-violet-500/30">
      {/* ── Topbar ── */}
      <header className="fixed inset-x-0 top-0 z-50 border-b border-slate-800/60 bg-slate-950/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-purple-600">
              <MessageSquare className="h-4 w-4 text-white" />
            </div>
            <span className="text-base font-bold tracking-tight">CRM for WhatsApp</span>
          </div>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-6 md:flex">
            <button onClick={scrollToPricing} className="text-sm text-slate-400 transition hover:text-white">Pricing</button>
            <a href="#features" className="text-sm text-slate-400 transition hover:text-white">Features</a>
            <a href="#faq" className="text-sm text-slate-400 transition hover:text-white">FAQ</a>
            <Link href="/login" className="text-sm text-slate-400 transition hover:text-white">Sign In</Link>
            <Link
              href="/signup"
              className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-700"
            >
              Start Free Trial
            </Link>
          </nav>

          {/* Mobile hamburger */}
          <button
            onClick={() => setNavOpen((v) => !v)}
            className="flex h-9 w-9 items-center justify-center rounded-md text-slate-400 hover:bg-slate-800 hover:text-white md:hidden"
            aria-label="Toggle menu"
          >
            {navOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {/* Mobile menu */}
        {navOpen && (
          <div className="border-t border-slate-800 bg-slate-950 px-4 py-4 md:hidden">
            <div className="flex flex-col gap-3">
              <button onClick={scrollToPricing} className="text-left text-sm text-slate-300 hover:text-white">Pricing</button>
              <a href="#features" onClick={() => setNavOpen(false)} className="text-sm text-slate-300 hover:text-white">Features</a>
              <a href="#faq" onClick={() => setNavOpen(false)} className="text-sm text-slate-300 hover:text-white">FAQ</a>
              <Link href="/login" onClick={() => setNavOpen(false)} className="text-sm text-slate-300 hover:text-white">Sign In</Link>
              <Link
                href="/signup"
                onClick={() => setNavOpen(false)}
                className="rounded-lg bg-violet-600 px-4 py-2.5 text-center text-sm font-semibold text-white"
              >
                Start Free Trial
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden pt-32 pb-24">
        {/* Radial glow background */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-40 left-1/2 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-violet-600/20 blur-3xl" />
          <div className="absolute top-60 -left-20 h-[300px] w-[300px] rounded-full bg-purple-600/10 blur-3xl" />
          <div className="absolute top-40 -right-20 h-[300px] w-[300px] rounded-full bg-indigo-600/10 blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-5xl px-4 text-center sm:px-6">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-4 py-1.5 text-sm text-violet-300">
            <Sparkles className="h-4 w-4" />
            Now with Gemini AI Chatbot automation
          </div>

          <h1 className="mx-auto mb-6 max-w-3xl text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
            The Complete{' '}
            <span className="bg-gradient-to-r from-violet-400 via-purple-400 to-indigo-400 bg-clip-text text-transparent">
              WhatsApp CRM
            </span>{' '}
            for Modern Businesses
          </h1>

          <p className="mx-auto mb-10 max-w-2xl text-lg text-slate-400 sm:text-xl">
            Automate conversations, manage leads, run AI chatbots, and close deals — all from one powerful platform built on WhatsApp Business API.
          </p>

          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/signup"
              className="group inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 px-7 py-3.5 text-base font-semibold text-white shadow-lg shadow-violet-500/25 transition hover:shadow-violet-500/40 hover:brightness-110"
            >
              Start 1-Month Free Trial
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <button
              onClick={scrollToPricing}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-7 py-3.5 text-base font-medium text-slate-300 transition hover:border-slate-600 hover:text-white"
            >
              View Pricing
            </button>
          </div>

          <p className="mt-5 text-sm text-slate-500">
            No credit card required · 1 month free · Cancel anytime
          </p>

          {/* Stats strip */}
          <div className="mt-16 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { value: '10,000+', label: 'Messages/day' },
              { value: '99.9%', label: 'Uptime SLA' },
              { value: '<50ms', label: 'API latency' },
              { value: '24/7', label: 'AI Chatbot' },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-4 backdrop-blur">
                <div className="text-2xl font-bold text-white">{s.value}</div>
                <div className="text-xs text-slate-500">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mb-14 text-center">
            <h2 className="mb-3 text-3xl font-bold sm:text-4xl">Everything you need, nothing you don't</h2>
            <p className="mx-auto max-w-xl text-slate-400">
              A full-stack WhatsApp CRM with AI automation, pipelines, broadcasts, and deep analytics — built for Indian businesses.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => {
              const Icon = f.icon
              return (
                <div
                  key={f.title}
                  className="group relative rounded-2xl border border-slate-800 bg-slate-900/60 p-5 transition hover:border-slate-700 hover:bg-slate-900"
                >
                  <div className={`mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${f.color}`}>
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                  <h3 className="mb-2 text-sm font-semibold text-white">{f.title}</h3>
                  <p className="text-xs leading-relaxed text-slate-400">{f.description}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── AI Chatbot Feature Spotlight ── */}
      <section className="py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="overflow-hidden rounded-3xl border border-emerald-500/20 bg-gradient-to-br from-slate-900 via-emerald-950/30 to-slate-900">
            <div className="grid gap-10 p-8 sm:p-12 lg:grid-cols-2 lg:items-center">
              <div>
                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400">
                  <Bot className="h-3.5 w-3.5" />
                  Powered by Google Gemini AI
                </div>
                <h2 className="mb-4 text-3xl font-bold sm:text-4xl">
                  Your AI agent that{' '}
                  <span className="text-emerald-400">never sleeps</span>
                </h2>
                <p className="mb-6 text-slate-400">
                  Configure a Gemini-powered chatbot with your own persona and business knowledge base. It reads every incoming WhatsApp message and replies intelligently — automatically — 24/7.
                </p>
                <ul className="space-y-3">
                  {[
                    'Custom persona and tone per automation',
                    'Inject your own business knowledge base',
                    'Understands Hindi, English, and mixed language',
                    'Triggered on keywords, first message, or any event',
                    'Full conversation history stays in your CRM',
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-sm text-slate-300">
                      <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-400" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Code card mockup */}
              <div className="rounded-2xl border border-emerald-500/20 bg-slate-950/80 p-5 font-mono text-xs">
                <div className="mb-3 flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-full bg-rose-500" />
                  <div className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                  <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  <span className="ml-2 text-slate-500">AI Chatbot Step Config</span>
                </div>
                <div className="space-y-2 text-slate-300">
                  <div><span className="text-violet-400">system_prompt</span>: <span className="text-amber-300">"You are Aria, the AI assistant for BK Nuxes. Greet leads warmly but keep messages under 3 lines. Qualify business type."</span></div>
                  <div className="mt-2"><span className="text-violet-400">knowledge_base</span>: <span className="text-amber-300">"Services: Admin Dashboard (₹12k + ₹1.5k/mo), Landing Page (₹5k + ₹800/mo), E-commerce Store (₹18k + ₹2.5k/mo). Live preview built on call."</span></div>
                  <div className="mt-3 border-t border-slate-800 pt-3 text-slate-400">
                    <span className="text-emerald-400">▶ Auto-reply generated:</span>
                    <p className="mt-1 text-slate-300">"Hi! I'm Aria from BK Nuxes. Quick question — what kind of business do you run? 😊"</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" ref={pricingRef} className="py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mb-14 text-center">
            <h2 className="mb-3 text-3xl font-bold sm:text-4xl">Simple, transparent pricing</h2>
            <p className="text-slate-400">Start with a 1-month free trial. No credit card required.</p>
          </div>

          <div className="mx-auto grid max-w-4xl gap-6 lg:grid-cols-3">
            {/* Free Trial */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
              <div className="mb-4">
                <div className="mb-1 text-sm font-semibold uppercase tracking-wide text-slate-400">Free Trial</div>
                <div className="text-4xl font-extrabold text-white">₹0</div>
                <div className="text-xs text-slate-500">for 1 month</div>
              </div>
              <ul className="mb-6 space-y-2.5">
                {['All features unlocked', '1,000 messages/month', '1 WhatsApp number', 'AI Chatbot included', 'Email support'].map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-slate-300">
                    <Check className="h-4 w-4 text-violet-400" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href="/signup"
                className="block w-full rounded-lg border border-slate-700 py-2.5 text-center text-sm font-semibold text-white transition hover:border-slate-600 hover:bg-slate-800"
              >
                Start Free →
              </Link>
            </div>

            {/* Starter */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
              <div className="mb-4">
                <div className="mb-1 text-sm font-semibold uppercase tracking-wide text-slate-400">Starter</div>
                <div className="flex items-baseline gap-1">
                  <div className="text-4xl font-extrabold text-white">₹{starterPrice.toLocaleString('en-IN')}</div>
                  <div className="text-sm text-slate-500">/mo</div>
                </div>
                <div className="text-xs text-slate-500">billed monthly</div>
              </div>
              <ul className="mb-6 space-y-2.5">
                {['Everything in Free Trial', '10,000 messages/month', '2 WhatsApp numbers', 'Advanced automations', 'Priority support'].map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-slate-300">
                    <Check className="h-4 w-4 text-violet-400" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href="/signup"
                className="block w-full rounded-lg border border-slate-700 py-2.5 text-center text-sm font-semibold text-white transition hover:border-slate-600 hover:bg-slate-800"
              >
                Get Started →
              </Link>
            </div>

            {/* Pro */}
            <div className="relative rounded-2xl border-2 border-violet-500 bg-gradient-to-b from-violet-950/60 to-slate-900/80 p-6">
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-violet-600 px-3 py-0.5 text-xs font-semibold text-white">
                Most Popular
              </div>
              <div className="mb-4">
                <div className="mb-1 text-sm font-semibold uppercase tracking-wide text-violet-400">Pro</div>
                <div className="flex items-baseline gap-1">
                  <div className="text-4xl font-extrabold text-white">₹{proPrice.toLocaleString('en-IN')}</div>
                  <div className="text-sm text-slate-500">/mo</div>
                </div>
                <div className="text-xs text-slate-500">billed monthly</div>
              </div>
              <ul className="mb-6 space-y-2.5">
                {['Everything in Starter', 'Unlimited messages', 'Unlimited WhatsApp numbers', 'AI Chatbot (Gemini 2.0)', 'Team collaboration', 'Dedicated support', 'Custom integrations'].map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-slate-300">
                    <Check className="h-4 w-4 text-violet-400" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href="/signup"
                className="block w-full rounded-lg bg-violet-600 py-2.5 text-center text-sm font-semibold text-white transition hover:bg-violet-700"
              >
                Start Pro Trial →
              </Link>
            </div>
          </div>

          {/* Promo code widget */}
          <div className="mt-10">
            <PromoCodeWidget settings={settings} />
          </div>

          {/* Trust badges */}
          <div className="mt-12 flex flex-wrap items-center justify-center gap-6 text-sm text-slate-500">
            <span className="flex items-center gap-1.5"><Lock className="h-4 w-4" /> Bank-grade encryption</span>
            <span className="flex items-center gap-1.5"><Shield className="h-4 w-4" /> GDPR compliant</span>
            <span className="flex items-center gap-1.5"><Globe className="h-4 w-4" /> Indian data residency</span>
            <span className="flex items-center gap-1.5"><Tag className="h-4 w-4" /> GST invoice available</span>
          </div>
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section className="py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <h2 className="mb-12 text-center text-3xl font-bold">Loved by businesses across India</h2>
          <div className="grid gap-6 sm:grid-cols-3">
            {TESTIMONIALS.map((t) => (
              <div key={t.name} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
                <div className="mb-3 flex gap-1">
                  {Array.from({ length: t.stars }).map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <p className="mb-4 text-sm leading-relaxed text-slate-300">&ldquo;{t.text}&rdquo;</p>
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-violet-500/20 text-xs font-semibold text-violet-300">
                    {t.avatar}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-white">{t.name}</div>
                    <div className="text-xs text-slate-500">{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="py-20">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <h2 className="mb-12 text-center text-3xl font-bold">Frequently Asked Questions</h2>
          <div className="space-y-3">
            {FAQS.map((faq, i) => (
              <div
                key={i}
                className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="flex w-full items-center justify-between px-5 py-4 text-left text-sm font-medium text-white hover:bg-slate-800/40"
                >
                  {faq.q}
                  <ChevronRight
                    className={`h-4 w-4 flex-shrink-0 text-slate-400 transition-transform ${openFaq === i ? 'rotate-90' : ''}`}
                  />
                </button>
                {openFaq === i && (
                  <div className="border-t border-slate-800 px-5 py-3 text-sm text-slate-400 leading-relaxed">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Banner ── */}
      <section className="py-20">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-violet-900 via-purple-900 to-indigo-900 p-10 text-center sm:p-16">
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-violet-500/20 blur-3xl" />
              <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-indigo-500/20 blur-3xl" />
            </div>
            <div className="relative">
              <h2 className="mb-4 text-3xl font-bold sm:text-4xl">
                Ready to supercharge your WhatsApp?
              </h2>
              <p className="mx-auto mb-8 max-w-xl text-slate-300">
                Join hundreds of businesses already using CRM for WhatsApp to automate conversations and close more deals.
              </p>
              <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
                <Link
                  href="/signup"
                  className="group inline-flex items-center gap-2 rounded-xl bg-white px-7 py-3.5 text-base font-semibold text-violet-900 transition hover:bg-slate-100"
                >
                  Start Free Trial
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
                <Link href="/login" className="text-sm text-slate-300 hover:text-white">
                  Already have an account? Sign in →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-slate-800 py-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-purple-600">
                <MessageSquare className="h-3.5 w-3.5 text-white" />
              </div>
              <span className="text-sm font-semibold text-white">CRM for WhatsApp</span>
            </div>
            <div className="flex items-center gap-6 text-xs text-slate-500">
              <Link href="/login" className="hover:text-slate-300">Sign In</Link>
              <Link href="/signup" className="hover:text-slate-300">Sign Up</Link>
              <span>© {new Date().getFullYear()} CRM for WhatsApp. All rights reserved.</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
