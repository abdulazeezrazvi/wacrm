"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  ArrowLeft,
  ChevronDown,
  Plus,
  Trash2,
  GripVertical,
  MessageSquare,
  FileText,
  Tag,
  TagIcon,
  UserCheck,
  PencilLine,
  Briefcase,
  Hourglass,
  GitBranch,
  Webhook,
  CircleSlash,
  Zap,
  Loader2,
  ArrowDown,
  ArrowUp,
  Bot,
  FileSpreadsheet,
  Calendar,
  BookOpen,
  Mail,
  Bell,
  Search,
  X,
  LayoutGrid,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import type {
  AutomationStepType,
  AutomationTriggerType,
  KeywordMatchTriggerConfig,
} from "@/types"
import { cn } from "@/lib/utils"

// ------------------------------------------------------------
// Types (builder-local — mirror the flattened rows we POST)
// ------------------------------------------------------------

export interface BuilderStep {
  /** Client id; the API assigns real UUIDs server-side. */
  cid: string
  step_type: AutomationStepType
  step_config: Record<string, unknown>
  branches?: { yes: BuilderStep[]; no: BuilderStep[] }
}

export interface BuilderInitial {
  id?: string
  name: string
  description: string
  trigger_type: AutomationTriggerType
  trigger_config: Record<string, unknown>
  is_active: boolean
  steps: BuilderStep[]
}

// ------------------------------------------------------------
// Step metadata — one source of truth for icon + label + border color
// ------------------------------------------------------------

interface StepMeta {
  label: string
  icon: typeof Zap
  /** Left-border accent color per spec. */
  border: string
}

const STEP_META: Record<AutomationStepType, StepMeta> = {
  send_message: { label: "Send Message", icon: MessageSquare, border: "border-l-violet-500" },
  send_template: { label: "Send Template", icon: FileText, border: "border-l-violet-500" },
  add_tag: { label: "Add Tag", icon: Tag, border: "border-l-violet-500" },
  remove_tag: { label: "Remove Tag", icon: TagIcon, border: "border-l-violet-500" },
  assign_conversation: { label: "Assign Conversation", icon: UserCheck, border: "border-l-violet-500" },
  update_contact_field: { label: "Update Contact Field", icon: PencilLine, border: "border-l-violet-500" },
  create_deal: { label: "Create Deal", icon: Briefcase, border: "border-l-violet-500" },
  wait: { label: "Wait", icon: Hourglass, border: "border-l-slate-500" },
  condition: { label: "Condition (If/Else)", icon: GitBranch, border: "border-l-amber-500" },
  send_webhook: { label: "Send Webhook", icon: Webhook, border: "border-l-violet-500" },
  close_conversation: { label: "Close Conversation", icon: CircleSlash, border: "border-l-violet-500" },
  ai_chatbot: { label: "AI Chatbot Reply", icon: Bot, border: "border-l-emerald-500" },
  google_sheets: { label: "Google Sheets", icon: FileSpreadsheet, border: "border-l-green-500" },
  google_calendar: { label: "Google Calendar", icon: Calendar, border: "border-l-blue-500" },
  notion: { label: "Notion", icon: BookOpen, border: "border-l-slate-400" },
  send_email: { label: "Send Email", icon: Mail, border: "border-l-orange-500" },
  send_admin_alert: { label: "Send Admin Alert", icon: Bell, border: "border-l-red-500" },
}

interface NodeCategory {
  id: string
  label: string
  steps: AutomationStepType[]
}

const NODE_CATEGORIES: NodeCategory[] = [
  {
    id: "messaging",
    label: "Messaging",
    steps: ["send_message", "send_template", "ai_chatbot"],
  },
  {
    id: "crm",
    label: "CRM",
    steps: [
      "add_tag",
      "remove_tag",
      "assign_conversation",
      "update_contact_field",
      "create_deal",
    ],
  },
  {
    id: "integrations",
    label: "Integrations",
    steps: ["google_sheets", "google_calendar", "notion"],
  },
  {
    id: "notifications",
    label: "Notifications",
    steps: ["send_email", "send_admin_alert"],
  },
  {
    id: "flow_control",
    label: "Flow Control",
    steps: ["wait", "condition", "send_webhook", "close_conversation"],
  },
]

const ADDABLE_STEPS: AutomationStepType[] = [
  "send_message",
  "send_template",
  "ai_chatbot",
  "add_tag",
  "remove_tag",
  "assign_conversation",
  "update_contact_field",
  "create_deal",
  "wait",
  "condition",
  "send_webhook",
  "close_conversation",
  "google_sheets",
  "google_calendar",
  "notion",
  "send_email",
  "send_admin_alert",
]

const STEP_DESCRIPTIONS: Record<AutomationStepType, string> = {
  send_message: "Send a WhatsApp text message to the contact.",
  send_template: "Send a pre-approved Meta WhatsApp template.",
  add_tag: "Add a label/tag to segment this contact.",
  remove_tag: "Remove a label/tag from this contact.",
  assign_conversation: "Assign the chat to a specific agent or round-robin.",
  update_contact_field: "Update contact details (Name, Email, Company).",
  create_deal: "Create a new sales opportunity in the CRM pipeline.",
  wait: "Pause execution for minutes, hours, or days.",
  condition: "Branch the automation flow based on criteria (If/Else).",
  send_webhook: "Send data to external tools (n8n, Zapier, APIs).",
  close_conversation: "Mark the chat status as Closed.",
  ai_chatbot: "Leverage Gemini to respond to customer inquiries automatically.",
  google_sheets: "Append row data directly to a Google Spreadsheet.",
  google_calendar: "Schedule meetings or block time in Google Calendar.",
  notion: "Add new pages or database records to Notion.",
  send_email: "Send custom emails via SMTP relay or custom servers.",
  send_admin_alert: "Notify admins on WhatsApp when critical events occur.",
}

const TRIGGER_OPTIONS: { value: AutomationTriggerType; label: string; hint: string }[] = [
  { value: "new_message_received", label: "New Message Received", hint: "Any incoming message" },
  {
    value: "first_inbound_message",
    label: "First Message from Contact",
    hint: "First time this contact ever messages you (works for manually-added contacts too)",
  },
  { value: "keyword_match", label: "Keyword Match", hint: "Message contains specific keyword(s)" },
  { value: "new_contact_created", label: "New Contact Created", hint: "When a contact is auto-created from an incoming message" },
  { value: "conversation_assigned", label: "Conversation Assigned", hint: "When assigned to an agent" },
  { value: "tag_added", label: "Tag Added", hint: "When a tag is added to a contact" },
  { value: "time_based", label: "Time-Based", hint: "On a recurring schedule" },
  { value: "telegram_message_received", label: "Telegram Message Received", hint: "Any incoming Telegram message" },
  { value: "telegram_keyword_match", label: "Telegram Keyword Match", hint: "Telegram message contains specific keyword(s)" },
]

function cid(): string {
  return (
    "c_" +
    (typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36))
  )
}

function blankConfig(type: AutomationStepType): Record<string, unknown> {
  switch (type) {
    case "send_message":
      return { text: "" }
    case "send_template":
      return { template_name: "", language: "en_US" }
    case "add_tag":
    case "remove_tag":
      return { tag_id: "" }
    case "assign_conversation":
      return { mode: "round_robin" }
    case "update_contact_field":
      return { field: "name", value: "" }
    case "create_deal":
      return { pipeline_id: "", stage_id: "", title: "", value: 0 }
    case "wait":
      return { amount: 1, unit: "hours" }
    case "condition":
      return { subject: "tag_presence", operand: "", value: "" }
    case "send_webhook":
      return { url: "", headers: {}, body_template: "" }
    case "close_conversation":
      return {}
    case "ai_chatbot":
      return { system_prompt: "You are a helpful customer support assistant.", knowledge_base: "", max_tokens: 300 }
    case "google_sheets":
      return { spreadsheet_id: "", sheet_name: "Sheet1", api_key: "", action: "append_row", row_data: {} }
    case "google_calendar":
      return { calendar_id: "primary", api_key: "", summary: "", description: "", start_time: "", end_time: "", timezone: "UTC" }
    case "notion":
      return { database_id: "", api_key: "", properties: {} }
    case "send_email":
      return { to: "", subject: "", body: "", smtp_host: "", smtp_port: 587, smtp_user: "", smtp_pass: "" }
    case "send_admin_alert":
      return { admin_phone: "", alert_message: "" }
    default:
      return {}
  }
}

// ------------------------------------------------------------
// Main builder component
// ------------------------------------------------------------

export function AutomationBuilder({ initial }: { initial: BuilderInitial }) {
  const router = useRouter()
  const isEditing = !!initial.id
  const [state, setState] = useState<BuilderInitial>(initial)
  const [saving, setSaving] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [panelOpen, setPanelOpen] = useState(true)
  const [activeInsertTarget, setActiveInsertTarget] = useState<{ parent: ParentScope; index: number } | null>(null)
  const [searchQuery, setSearchQuery] = useState("")

  function patchTop<K extends keyof BuilderInitial>(key: K, value: BuilderInitial[K]) {
    setState((s) => ({ ...s, [key]: value }))
  }

  // --- Step tree mutations (immutable) ---

  function updateStep(path: StepPath, updater: (s: BuilderStep) => BuilderStep) {
    setState((s) => ({ ...s, steps: mapAtPath(s.steps, path, updater) }))
  }

  function addStepAt(parent: ParentScope, index: number, type: AutomationStepType) {
    const node: BuilderStep = {
      cid: cid(),
      step_type: type,
      step_config: blankConfig(type),
      branches: type === "condition" ? { yes: [], no: [] } : undefined,
    }
    setState((s) => ({ ...s, steps: insertAt(s.steps, parent, index, node) }))
    setExpandedId(node.cid)
  }

  function deleteStepAt(path: StepPath) {
    setState((s) => ({ ...s, steps: removeAt(s.steps, path) }))
  }

  function moveStepAt(path: StepPath, direction: -1 | 1) {
    setState((s) => ({ ...s, steps: moveAt(s.steps, path, direction) }))
  }

  const handleAddStep = (type: AutomationStepType) => {
    if (activeInsertTarget) {
      addStepAt(activeInsertTarget.parent, activeInsertTarget.index, type)
      setActiveInsertTarget(null)
    } else {
      addStepAt({ kind: "root" }, state.steps.length, type)
    }
    toast.success(`Added ${STEP_META[type].label}`)
  }

  const filteredCategories = NODE_CATEGORIES.map((cat) => {
    const steps = cat.steps.filter((t) => {
      const label = STEP_META[t].label.toLowerCase()
      const desc = STEP_DESCRIPTIONS[t].toLowerCase()
      const q = searchQuery.toLowerCase()
      return label.includes(q) || desc.includes(q)
    })
    return { ...cat, steps }
  }).filter((cat) => cat.steps.length > 0)

  async function save() {
    setSaving(true)
    try {
      const payload = {
        name: state.name || "Untitled automation",
        description: state.description || null,
        trigger_type: state.trigger_type,
        trigger_config: state.trigger_config,
        is_active: state.is_active,
        steps: toApiSteps(state.steps),
      }

      const res = isEditing
        ? await fetch(`/api/automations/${initial.id}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch(`/api/automations`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(payload),
          })

      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        // If the server blocked activation with validation issues,
        // surface the first concrete problem so the user can fix it
        // without opening DevTools for the full array.
        const firstIssue: { path?: string; message?: string } | undefined =
          body?.issues?.[0]
        if (firstIssue?.message) {
          toast.error(firstIssue.message, {
            description: firstIssue.path ? `at ${firstIssue.path}` : undefined,
          })
        } else {
          toast.error(body?.error ?? "Save failed")
        }
        return
      }
      toast.success(isEditing ? "Automation saved" : "Automation created")
      if (!isEditing && body?.automation?.id) {
        router.replace(`/automations/${body.automation.id}/edit`)
      }
    } finally {
      setSaving(false)
    }
  }

  function exportWorkflow() {
    const dataToExport = {
      name: state.name,
      description: state.description,
      trigger_type: state.trigger_type,
      trigger_config: state.trigger_config,
      is_active: state.is_active,
      steps: state.steps,
    }
    navigator.clipboard.writeText(JSON.stringify(dataToExport, null, 2))
    toast.success("Workflow JSON copied to clipboard!")
  }

  function importWorkflow() {
    const jsonStr = prompt("Paste your workflow JSON code here:")
    if (!jsonStr) return
    try {
      const parsed = JSON.parse(jsonStr)
      if (!parsed.trigger_type || !Array.isArray(parsed.steps)) {
        throw new Error("Missing trigger_type or steps array")
      }
      const restoreCids = (stepList: any[]): BuilderStep[] => {
        return stepList.map((s) => ({
          cid: s.cid || Math.random().toString(36).substring(2, 9),
          step_type: s.step_type,
          step_config: s.step_config || {},
          branches: s.branches
            ? {
                yes: restoreCids(s.branches.yes || []),
                no: restoreCids(s.branches.no || []),
              }
            : undefined,
        }))
      }

      setState((s) => ({
        ...s,
        name: parsed.name || s.name || "Imported Automation",
        description: parsed.description || s.description || "",
        trigger_type: parsed.trigger_type,
        trigger_config: parsed.trigger_config || {},
        is_active: !!parsed.is_active,
        steps: restoreCids(parsed.steps),
      }))
      toast.success("Workflow imported successfully!")
    } catch (err: any) {
      toast.error("Invalid workflow JSON: " + err.message)
    }
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-slate-950">
      {/* Top bar. At sub-sm widths the "Active" label is hidden and the
          switch moves to the right of the save button, so the name input
          gets maximum width. */}
      <header className="flex flex-shrink-0 items-center gap-2 border-b border-slate-800 bg-slate-900/80 px-3 py-3 sm:gap-3 sm:px-4">
        <button
          type="button"
          onClick={() => router.push("/automations")}
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
          aria-label="Back to automations"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <input
          value={state.name}
          onChange={(e) => patchTop("name", e.target.value)}
          placeholder="Untitled automation"
          className="min-w-0 flex-1 rounded-md bg-transparent px-2 py-1 text-sm font-semibold text-white placeholder:text-slate-500 focus:bg-slate-800 focus:outline-none sm:text-base"
        />
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span className="hidden sm:inline">Active</span>
          <Switch
            checked={state.is_active}
            onCheckedChange={(v) => patchTop("is_active", !!v)}
            aria-label="Active"
          />
        </div>

        {/* Toggle Panel Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setPanelOpen(!panelOpen)}
          className={cn(
            "h-8 border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white",
            panelOpen && "border-violet-500 bg-violet-500/10 text-violet-400"
          )}
        >
          <LayoutGrid className="mr-1.5 h-3.5 w-3.5" />
          <span className="hidden md:inline">{panelOpen ? "Hide Panel" : "Show Panel"}</span>
        </Button>

        {/* Import/Export buttons */}
        <Button
          variant="outline"
          size="sm"
          onClick={importWorkflow}
          className="h-8 border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white"
          title="Import Workflow JSON"
        >
          <ArrowDown className="mr-1 h-3.5 w-3.5" />
          <span className="hidden sm:inline">Import</span>
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={exportWorkflow}
          className="h-8 border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white"
          title="Export Workflow JSON"
        >
          <ArrowUp className="mr-1 h-3.5 w-3.5" />
          <span className="hidden sm:inline">Export</span>
        </Button>

        <Button
          onClick={save}
          disabled={saving}
          className="bg-violet-600 text-white hover:bg-violet-700 h-8 text-xs sm:h-9 sm:text-sm"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {isEditing ? "Save" : "Save Draft"}
        </Button>
      </header>

      {/* Main Container */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Canvas Area */}
        <div className="relative flex-1 overflow-y-auto">
          <div className="absolute inset-0 bg-[radial-gradient(circle,#1e293b_1px,transparent_1px)] [background-size:20px_20px] pointer-events-none" />
          <div className="relative mx-auto flex max-w-2xl flex-col items-center gap-0 px-4 py-10">
            <TriggerCard
              type={state.trigger_type}
              config={state.trigger_config}
              onTypeChange={(t) => patchTop("trigger_type", t)}
              onConfigChange={(c) => patchTop("trigger_config", c)}
            />
            <StepList
              steps={state.steps}
              parentPath={[]}
              expandedId={expandedId}
              setExpandedId={setExpandedId}
              updateStep={updateStep}
              addStepAt={addStepAt}
              deleteStepAt={deleteStepAt}
              moveStepAt={moveStepAt}
              activeInsertTarget={activeInsertTarget}
              setActiveInsertTarget={setActiveInsertTarget}
              setPanelOpen={setPanelOpen}
            />
          </div>
        </div>

        {/* Mobile Backdrop */}
        {panelOpen && (
          <div
            className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-sm lg:hidden"
            onClick={() => setPanelOpen(false)}
          />
        )}

        {/* Searchable Node Panel */}
        <div
          className={cn(
            "fixed inset-y-0 right-0 z-50 flex w-80 flex-col border-l border-slate-800 bg-slate-900 transition-transform duration-300 ease-in-out lg:static lg:z-0 lg:translate-x-0",
            panelOpen ? "translate-x-0" : "translate-x-full"
          )}
        >
          {/* Panel Header */}
          <div className="flex flex-shrink-0 items-center justify-between border-b border-slate-800 px-4 py-3">
            <div>
              <h3 className="text-sm font-semibold text-white">Automation Nodes</h3>
              <p className="text-[10px] text-slate-400">
                {activeInsertTarget
                  ? "Select a node to insert at marked position"
                  : "Click a node to append to the end"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setPanelOpen(false)}
              className="rounded-md p-1 text-slate-500 hover:bg-slate-805 hover:text-white lg:hidden"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Search Input */}
          <div className="flex-shrink-0 border-b border-slate-800 p-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-500" />
              <input
                type="text"
                placeholder="Search nodes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-md border border-slate-700 bg-slate-800 py-1.5 pl-8 pr-8 text-xs text-white placeholder-slate-500 focus:border-violet-500 focus:outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-2.5 text-slate-500 hover:text-white"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Nodes list */}
          <div className="flex-1 overflow-y-auto p-3 space-y-4">
            {filteredCategories.map((category) => (
              <div key={category.id} className="space-y-1">
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 px-1">
                  {category.label}
                </h4>
                <div className="space-y-1">
                  {category.steps.map((t) => {
                    const meta = STEP_META[t]
                    const Icon = meta.icon
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => handleAddStep(t)}
                        className="flex w-full items-start gap-2.5 rounded-lg border border-transparent bg-slate-900/40 p-2 text-left transition-all hover:border-slate-800 hover:bg-slate-800/60 hover:shadow-md hover:scale-[1.01]"
                      >
                        <div className={cn(
                          "flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md text-slate-300 bg-slate-800/80 border-l-2",
                          meta.border
                        )}>
                          <Icon className="h-3.5 w-3.5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-medium text-white">{meta.label}</div>
                          <div className="line-clamp-2 text-[10px] text-slate-400 mt-0.5 leading-tight">
                            {STEP_DESCRIPTIONS[t]}
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
            {filteredCategories.length === 0 && (
              <div className="py-8 text-center text-xs text-slate-500">
                No nodes match &quot;{searchQuery}&quot;
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ------------------------------------------------------------
// Trigger card
// ------------------------------------------------------------

function TriggerCard({
  type,
  config,
  onTypeChange,
  onConfigChange,
}: {
  type: AutomationTriggerType
  config: Record<string, unknown>
  onTypeChange: (t: AutomationTriggerType) => void
  onConfigChange: (c: Record<string, unknown>) => void
}) {
  const [open, setOpen] = useState(false)
  return (
    // Card width: full on mobile, fixed 320px on sm+. The canvas wrapper
    // (max-w-2xl + px-4) keeps this tidy on tablet/desktop.
    <div className="z-10 w-full max-w-[320px] sm:w-80">
      <div className="rounded-lg border border-slate-800 border-l-4 border-l-blue-500 bg-slate-900 shadow-lg">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center gap-3 px-4 py-3 text-left"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-500/10 text-blue-400">
            <Zap className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] uppercase tracking-wide text-blue-300">Trigger</div>
            <div className="truncate text-sm font-medium text-white">
              {TRIGGER_OPTIONS.find((o) => o.value === type)?.label ?? type}
            </div>
          </div>
          <ChevronDown
            className={cn("h-4 w-4 text-slate-400 transition-transform", open && "rotate-180")}
          />
        </button>
        {open && (
          <div className="space-y-3 border-t border-slate-800 px-4 py-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">
                Trigger type
              </label>
              <select
                value={type}
                onChange={(e) => onTypeChange(e.target.value as AutomationTriggerType)}
                className="w-full rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-sm text-white focus:border-violet-500 focus:outline-none"
              >
                {TRIGGER_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-slate-500">
                {TRIGGER_OPTIONS.find((o) => o.value === type)?.hint}
              </p>
            </div>
            {(type === "keyword_match" || type === "telegram_keyword_match") && (
              <KeywordMatchConfig
                config={config as unknown as KeywordMatchTriggerConfig}
                onChange={onConfigChange}
              />
            )}
            {(type === "telegram_message_received" || type === "telegram_keyword_match") && (
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-400">
                  Telegram Bot Token
                </label>
                <Input
                  type="password"
                  placeholder="Paste HTTP API Token here"
                  value={(config.bot_token as string) ?? ""}
                  onChange={(e) =>
                    onConfigChange({ ...config, bot_token: e.target.value })
                  }
                  className="bg-slate-800 text-white font-mono"
                />
                <p className="text-[11px] leading-normal text-slate-500">
                  Search for{" "}
                  <a
                    href="https://t.me/BotFather"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-violet-400 hover:underline"
                  >
                    @BotFather
                  </a>{" "}
                  on Telegram, send the <code>/newbot</code> command, follow the steps, and copy the HTTP API Token it provides.
                </p>
              </div>
            )}
            {type === "tag_added" && (
              <Input
                placeholder="Tag id"
                value={(config.tag_id as string) ?? ""}
                onChange={(e) =>
                  onConfigChange({ ...config, tag_id: e.target.value })
                }
                className="bg-slate-800 text-white"
              />
            )}
            {type === "time_based" && (
              <Input
                placeholder="Cron expression or HH:mm"
                value={(config.schedule as string) ?? ""}
                onChange={(e) =>
                  onConfigChange({ ...config, schedule: e.target.value })
                }
                className="bg-slate-800 text-white"
              />
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function KeywordMatchConfig({
  config,
  onChange,
}: {
  config: KeywordMatchTriggerConfig
  onChange: (c: Record<string, unknown>) => void
}) {
  const keywords = config?.keywords ?? []
  return (
    <div className="space-y-2">
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-400">
          Keywords (comma-separated)
        </label>
        <Input
          value={keywords.join(", ")}
          onChange={(e) =>
            onChange({
              ...config,
              keywords: e.target.value
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
            })
          }
          className="bg-slate-800 text-white"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-400">
          Match type
        </label>
        <select
          value={config?.match_type ?? "contains"}
          onChange={(e) => onChange({ ...config, match_type: e.target.value as "exact" | "contains" })}
          className="w-full rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-sm text-white focus:outline-none"
        >
          <option value="contains">Contains</option>
          <option value="exact">Exact</option>
        </select>
      </div>
    </div>
  )
}

// ------------------------------------------------------------
// Step list + card + connectors
// ------------------------------------------------------------

type ParentScope =
  | { kind: "root" }
  | { kind: "branch"; parentCid: string; branch: "yes" | "no" }

type StepPath = (
  | { kind: "root"; index: number }
  | { kind: "branch"; parentCid: string; branch: "yes" | "no"; index: number }
)[]

interface StepListProps {
  steps: BuilderStep[]
  parentPath: StepPath
  expandedId: string | null
  setExpandedId: (id: string | null) => void
  updateStep: (path: StepPath, updater: (s: BuilderStep) => BuilderStep) => void
  addStepAt: (parent: ParentScope, index: number, type: AutomationStepType) => void
  deleteStepAt: (path: StepPath) => void
  moveStepAt: (path: StepPath, direction: -1 | 1) => void
  activeInsertTarget: { parent: ParentScope; index: number } | null
  setActiveInsertTarget: (target: { parent: ParentScope; index: number } | null) => void
  setPanelOpen: (open: boolean) => void
}

function StepList(props: StepListProps) {
  const { steps, parentPath, ...rest } = props
  const parentScope: ParentScope =
    parentPath.length === 0
      ? { kind: "root" }
      : (() => {
          const last = parentPath[parentPath.length - 1]
          if (last.kind !== "branch") return { kind: "root" } as const
          return { kind: "branch", parentCid: last.parentCid, branch: last.branch } as const
        })()

  return (
    <div className="flex flex-col items-center w-full">
      <AddButton
        parentScope={parentScope}
        index={0}
        activeInsertTarget={props.activeInsertTarget}
        setActiveInsertTarget={props.setActiveInsertTarget}
        setPanelOpen={props.setPanelOpen}
      />
      {steps.map((step, idx) => (
        <StepRenderer
          key={step.cid}
          step={step}
          index={idx}
          total={steps.length}
          parentScope={parentScope}
          parentPath={parentPath}
          {...rest}
        />
      ))}
    </div>
  )
}

function StepRenderer({
  step,
  index,
  total,
  parentScope,
  parentPath,
  ...props
}: {
  step: BuilderStep
  index: number
  total: number
  parentScope: ParentScope
  parentPath: StepPath
} & Omit<StepListProps, "steps" | "parentPath">) {
  const path: StepPath = [
    ...parentPath,
    parentScope.kind === "root"
      ? { kind: "root", index }
      : { kind: "branch", parentCid: parentScope.parentCid, branch: parentScope.branch, index },
  ]
  const meta = STEP_META[step.step_type]
  const Icon = meta.icon
  const expanded = props.expandedId === step.cid
  const isCondition = step.step_type === "condition"
  // Card widths on mobile fill the full canvas column (max-w-2xl px-4
  // still keeps them reasonable). On sm+ the original fixed widths
  // come back so the flow visual stays recognisable.
  const width = isCondition
    ? "w-full max-w-[400px] sm:w-[400px]"
    : "w-full max-w-[320px] sm:w-80"

  return (
    <>
      <div className={cn("z-10 flex flex-col", width)}>
        <div
          className={cn(
            "rounded-lg border border-slate-800 border-l-4 bg-slate-900 shadow-lg",
            meta.border,
          )}
        >
          <button
            type="button"
            onClick={() => props.setExpandedId(expanded ? null : step.cid)}
            className="flex w-full items-center gap-3 px-4 py-3 text-left"
          >
            <GripVertical className="h-4 w-4 flex-shrink-0 text-slate-600" aria-hidden />
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-800 text-slate-300">
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] uppercase tracking-wide text-slate-400">
                {isCondition ? "Condition" : step.step_type === "wait" ? "Wait" : "Action"}
              </div>
              <div className="truncate text-sm font-medium text-white">{meta.label}</div>
              <div className="truncate text-[11px] text-slate-500">{previewFor(step)}</div>
            </div>
            <ChevronDown
              className={cn("h-4 w-4 text-slate-400 transition-transform", expanded && "rotate-180")}
            />
          </button>
          {expanded && (
            <div className="border-t border-slate-800 px-4 py-3">
              <StepEditor
                step={step}
                onChange={(next) => props.updateStep(path, () => next)}
              />
              <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-800 pt-3">
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={index === 0}
                    aria-label="Move up"
                    onClick={() => props.moveStepAt(path, -1)}
                  >
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={index === total - 1}
                    aria-label="Move down"
                    onClick={() => props.moveStepAt(path, 1)}
                  >
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => props.deleteStepAt(path)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </Button>
              </div>
            </div>
          )}
        </div>

        {isCondition && (
          <ConditionBranches step={step} parentPath={path} {...props} />
        )}
      </div>

      <AddButton
        parentScope={parentScope}
        index={index + 1}
        activeInsertTarget={props.activeInsertTarget}
        setActiveInsertTarget={props.setActiveInsertTarget}
        setPanelOpen={props.setPanelOpen}
      />
    </>
  )
}

function ConditionBranches({
  step,
  parentPath,
  ...props
}: {
  step: BuilderStep
  parentPath: StepPath
} & Omit<StepListProps, "steps" | "parentPath">) {
  const yes = step.branches?.yes ?? []
  const no = step.branches?.no ?? []
  // Build the child scope by appending a branch marker. The scope the
  // StepList uses is driven by the LAST element of parentPath, so the
  // tail's `index` doesn't matter — it's replaced per child during walks.
  const yesPath: StepPath = [
    ...parentPath,
    { kind: "branch", parentCid: step.cid, branch: "yes", index: 0 },
  ]
  const noPath: StepPath = [
    ...parentPath,
    { kind: "branch", parentCid: step.cid, branch: "no", index: 0 },
  ]
  return (
    // Stack Yes/No vertically on mobile — two columns at 375px would
    // cram each branch to ~170px which is too narrow for the nested
    // cards. Two-column grid returns on sm+.
    <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 w-full">
      <BranchColumn label="Yes" color="text-violet-400">
        <StepList {...props} steps={yes} parentPath={yesPath} />
      </BranchColumn>
      <BranchColumn label="No" color="text-rose-400">
        <StepList {...props} steps={no} parentPath={noPath} />
      </BranchColumn>
    </div>
  )
}

function BranchColumn({
  label,
  color,
  children,
}: {
  label: string
  color: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center w-full">
      <div className={cn("mb-2 text-[11px] font-semibold uppercase", color)}>{label}</div>
      {children}
    </div>
  )
}

function AddButton({
  parentScope,
  index,
  activeInsertTarget,
  setActiveInsertTarget,
  setPanelOpen,
}: {
  parentScope: ParentScope
  index: number
  activeInsertTarget: { parent: ParentScope; index: number } | null
  setActiveInsertTarget: (target: { parent: ParentScope; index: number } | null) => void
  setPanelOpen: (open: boolean) => void
}) {
  const isActive =
    activeInsertTarget &&
    JSON.stringify(activeInsertTarget.parent) === JSON.stringify(parentScope) &&
    activeInsertTarget.index === index

  const handleClick = () => {
    if (isActive) {
      setActiveInsertTarget(null)
    } else {
      setActiveInsertTarget({ parent: parentScope, index })
      setPanelOpen(true)
    }
  }

  return (
    <div className="relative flex flex-col items-center group">
      <div className="h-4 w-[2px] bg-slate-700" aria-hidden />
      <button
        type="button"
        onClick={handleClick}
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-full border-2 border-dashed transition-all duration-200",
          isActive
            ? "border-violet-500 bg-violet-600 text-white shadow-lg shadow-violet-500/30 scale-110 animate-pulse"
            : "border-slate-700 bg-slate-950 text-slate-400 hover:border-violet-500 hover:bg-violet-500/10 hover:text-violet-400"
        )}
        aria-label="Add step"
      >
        <Plus className="h-4 w-4" />
      </button>
      <div className="h-4 w-[2px] bg-slate-700" aria-hidden />
    </div>
  )
}

// ------------------------------------------------------------
// Per-step config editor
// ------------------------------------------------------------

function StepEditor({
  step,
  onChange,
}: {
  step: BuilderStep
  onChange: (s: BuilderStep) => void
}) {
  const cfg = step.step_config
  const set = (patch: Record<string, unknown>) =>
    onChange({ ...step, step_config: { ...cfg, ...patch } })

  switch (step.step_type) {
    case "send_message":
      return (
        <FieldBlock label="Message text">
          <Textarea
            value={(cfg.text as string) ?? ""}
            onChange={(e) => set({ text: e.target.value })}
            placeholder="Hi! Thanks for reaching out…"
            className="min-h-24 bg-slate-800 text-white"
          />
        </FieldBlock>
      )
    case "send_template":
      return (
        <>
          <FieldBlock label="Template name">
            <Input
              value={(cfg.template_name as string) ?? ""}
              onChange={(e) => set({ template_name: e.target.value })}
              className="bg-slate-800 text-white"
            />
          </FieldBlock>
          <FieldBlock label="Language">
            <Input
              value={(cfg.language as string) ?? ""}
              onChange={(e) => set({ language: e.target.value })}
              className="bg-slate-800 text-white"
            />
          </FieldBlock>
        </>
      )
    case "add_tag":
    case "remove_tag":
      return (
        <FieldBlock label="Tag id">
          <Input
            value={(cfg.tag_id as string) ?? ""}
            onChange={(e) => set({ tag_id: e.target.value })}
            className="bg-slate-800 text-white"
          />
        </FieldBlock>
      )
    case "assign_conversation":
      return (
        <>
          <FieldBlock label="Mode">
            <select
              value={(cfg.mode as string) ?? "round_robin"}
              onChange={(e) => set({ mode: e.target.value })}
              className="w-full rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-sm text-white"
            >
              <option value="round_robin">Round-robin</option>
              <option value="specific">Specific agent</option>
            </select>
          </FieldBlock>
          {cfg.mode === "specific" && (
            <FieldBlock label="Agent id">
              <Input
                value={(cfg.agent_id as string) ?? ""}
                onChange={(e) => set({ agent_id: e.target.value })}
                className="bg-slate-800 text-white"
              />
            </FieldBlock>
          )}
        </>
      )
    case "update_contact_field":
      return (
        <>
          <FieldBlock label="Field">
            <select
              value={(cfg.field as string) ?? "name"}
              onChange={(e) => set({ field: e.target.value })}
              className="w-full rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-sm text-white"
            >
              <option value="name">Name</option>
              <option value="email">Email</option>
              <option value="company">Company</option>
            </select>
          </FieldBlock>
          <FieldBlock label="Value">
            <Input
              value={(cfg.value as string) ?? ""}
              onChange={(e) => set({ value: e.target.value })}
              className="bg-slate-800 text-white"
            />
          </FieldBlock>
        </>
      )
    case "create_deal":
      return (
        <>
          <FieldBlock label="Pipeline id">
            <Input
              value={(cfg.pipeline_id as string) ?? ""}
              onChange={(e) => set({ pipeline_id: e.target.value })}
              className="bg-slate-800 text-white"
            />
          </FieldBlock>
          <FieldBlock label="Stage id">
            <Input
              value={(cfg.stage_id as string) ?? ""}
              onChange={(e) => set({ stage_id: e.target.value })}
              className="bg-slate-800 text-white"
            />
          </FieldBlock>
          <FieldBlock label="Title">
            <Input
              value={(cfg.title as string) ?? ""}
              onChange={(e) => set({ title: e.target.value })}
              className="bg-slate-800 text-white"
            />
          </FieldBlock>
          <FieldBlock label="Value">
            <Input
              type="number"
              value={(cfg.value as number) ?? 0}
              onChange={(e) => set({ value: Number(e.target.value) })}
              className="bg-slate-800 text-white"
            />
          </FieldBlock>
        </>
      )
    case "wait":
      return (
        <div className="grid grid-cols-2 gap-2">
          <FieldBlock label="Amount">
            <Input
              type="number"
              min={1}
              value={(cfg.amount as number) ?? 1}
              onChange={(e) => set({ amount: Math.max(1, Number(e.target.value)) })}
              className="bg-slate-800 text-white"
            />
          </FieldBlock>
          <FieldBlock label="Unit">
            <select
              value={(cfg.unit as string) ?? "hours"}
              onChange={(e) => set({ unit: e.target.value })}
              className="w-full rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-sm text-white"
            >
              <option value="minutes">Minutes</option>
              <option value="hours">Hours</option>
              <option value="days">Days</option>
            </select>
          </FieldBlock>
        </div>
      )
    case "condition":
      return (
        <>
          <FieldBlock label="Subject">
            <select
              value={(cfg.subject as string) ?? "tag_presence"}
              onChange={(e) => set({ subject: e.target.value })}
              className="w-full rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-sm text-white"
            >
              <option value="tag_presence">Tag presence</option>
              <option value="contact_field">Contact field</option>
              <option value="message_content">Message content</option>
              <option value="time_of_day">Time of day</option>
            </select>
          </FieldBlock>
          <FieldBlock label="Operand">
            <Input
              placeholder={
                cfg.subject === "time_of_day"
                  ? "HH:mm-HH:mm"
                  : cfg.subject === "contact_field"
                  ? "name / email / company"
                  : cfg.subject === "tag_presence"
                  ? "tag id"
                  : ""
              }
              value={(cfg.operand as string) ?? ""}
              onChange={(e) => set({ operand: e.target.value })}
              className="bg-slate-800 text-white"
            />
          </FieldBlock>
          {(cfg.subject === "contact_field" || cfg.subject === "message_content") && (
            <FieldBlock label="Value">
              <Input
                value={(cfg.value as string) ?? ""}
                onChange={(e) => set({ value: e.target.value })}
                className="bg-slate-800 text-white"
              />
            </FieldBlock>
          )}
        </>
      )
    case "send_webhook":
      return (
        <>
          <FieldBlock label="URL">
            <Input
              value={(cfg.url as string) ?? ""}
              onChange={(e) => set({ url: e.target.value })}
              className="bg-slate-800 text-white"
            />
          </FieldBlock>
          <FieldBlock label="Body template (JSON)">
            <Textarea
              value={(cfg.body_template as string) ?? ""}
              onChange={(e) => set({ body_template: e.target.value })}
              className="min-h-20 bg-slate-800 font-mono text-xs text-white"
            />
          </FieldBlock>
        </>
      )
    case "close_conversation":
      return (
        <p className="text-xs text-slate-400">
          Sets the conversation status to &quot;closed&quot;. No configuration needed.
        </p>
      )
    case "ai_chatbot":
      return (
        <>
          <FieldBlock label="System Prompt / Persona">
            <Textarea
              value={(cfg.system_prompt as string) ?? ""}
              onChange={(e) => set({ system_prompt: e.target.value })}
              placeholder="You are a helpful assistant for [Business Name]. Reply in a friendly, professional tone..."
              className="min-h-24 bg-slate-800 text-white text-xs"
            />
          </FieldBlock>
          <FieldBlock label="Knowledge Base (optional)">
            <Textarea
              value={(cfg.knowledge_base as string) ?? ""}
              onChange={(e) => set({ knowledge_base: e.target.value })}
              placeholder="Business hours: Mon–Sat 9am–6pm. Services: ... Pricing: ..."
              className="min-h-20 bg-slate-800 text-white text-xs"
            />
            <p className="mt-1 text-[11px] text-slate-500">
              Paste your business info, FAQs, services, or product details here. The AI uses this to reply accurately.
            </p>
          </FieldBlock>
          <FieldBlock label="Max Tokens">
            <Input
              type="number"
              min={50}
              max={1000}
              value={(cfg.max_tokens as number) ?? 300}
              onChange={(e) => set({ max_tokens: Math.min(1000, Math.max(50, Number(e.target.value))) })}
              className="bg-slate-800 text-white"
            />
          </FieldBlock>
          <FieldBlock label="AI Model">
            <select
              value={(cfg.ai_model as string) ?? "gemini-2.0-flash"}
              onChange={(e) => set({ ai_model: e.target.value })}
              className="w-full rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-sm text-white"
            >
              <option value="gemini-2.0-flash">Gemini 2.0 Flash (Recommended)</option>
              <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
              <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
              <option value="gemini-2.0-pro-exp">Gemini 2.0 Pro Experimental</option>
            </select>
          </FieldBlock>
          <FieldBlock label="Gemini API Key (optional)">
            <Input
              type="password"
              value={(cfg.gemini_api_key as string) ?? ""}
              onChange={(e) => set({ gemini_api_key: e.target.value })}
              placeholder="AI API Key (starts with AIzaSy...)"
              className="bg-slate-800 text-white"
            />
            <p className="mt-1 text-[11px] text-slate-500">
              Provide a custom Gemini API key for this step. If left blank, it falls back to the server environment variable.
            </p>
          </FieldBlock>
          <div className="mt-2 rounded-md border border-emerald-500/20 bg-emerald-500/5 px-3 py-2">
            <p className="text-[11px] text-emerald-400">
              <span className="font-semibold">🤖 AI Chatbot</span> — When triggered, the selected Gemini model will read the last customer message and generate a reply using your persona and knowledge base, then send it via WhatsApp automatically.
            </p>
          </div>
        </>
      )
    case "google_sheets":
      return (
        <>
          <FieldBlock label="Spreadsheet URL or ID">
            <Input
              value={(cfg.spreadsheet_id as string) ?? ""}
              onChange={(e) => set({ spreadsheet_id: e.target.value })}
              placeholder="https://docs.google.com/spreadsheets/d/..."
              className="bg-slate-800 text-white"
            />
          </FieldBlock>
          <FieldBlock label="Sheet Name">
            <Input
              value={(cfg.sheet_name as string) ?? "Sheet1"}
              onChange={(e) => set({ sheet_name: e.target.value })}
              placeholder="Sheet1"
              className="bg-slate-800 text-white"
            />
          </FieldBlock>
          <FieldBlock label="Google API Key">
            <Input
              type="password"
              value={(cfg.api_key as string) ?? ""}
              onChange={(e) => set({ api_key: e.target.value })}
              placeholder="AIzaSy..."
              className="bg-slate-800 text-white"
            />
          </FieldBlock>
          <FieldBlock label="Row Data (Column Header → Value)">
            <KeyValueEditor
              values={(cfg.row_data as Record<string, string>) ?? {}}
              onChange={(v) => set({ row_data: v })}
              keyPlaceholder="Column Name"
              valuePlaceholder="Value (e.g. {{message.text}})"
            />
          </FieldBlock>
        </>
      )
    case "google_calendar":
      return (
        <>
          <FieldBlock label="Google API Key">
            <Input
              type="password"
              value={(cfg.api_key as string) ?? ""}
              onChange={(e) => set({ api_key: e.target.value })}
              placeholder="AIzaSy..."
              className="bg-slate-800 text-white"
            />
          </FieldBlock>
          <FieldBlock label="Calendar ID">
            <Input
              value={(cfg.calendar_id as string) ?? "primary"}
              onChange={(e) => set({ calendar_id: e.target.value })}
              placeholder="primary"
              className="bg-slate-800 text-white"
            />
          </FieldBlock>
          <FieldBlock label="Event Title (Summary)">
            <Input
              value={(cfg.summary as string) ?? ""}
              onChange={(e) => set({ summary: e.target.value })}
              placeholder="Meeting with {{contact.name}}"
              className="bg-slate-800 text-white"
            />
          </FieldBlock>
          <FieldBlock label="Description (optional)">
            <Textarea
              value={(cfg.description as string) ?? ""}
              onChange={(e) => set({ description: e.target.value })}
              placeholder="Details about the meeting..."
              className="min-h-16 bg-slate-800 text-white text-xs"
            />
          </FieldBlock>
          <div className="grid grid-cols-2 gap-2">
            <FieldBlock label="Start Time (ISO/Text)">
              <Input
                value={(cfg.start_time as string) ?? ""}
                onChange={(e) => set({ start_time: e.target.value })}
                placeholder="2026-06-01T10:00:00Z"
                className="bg-slate-800 text-white"
              />
            </FieldBlock>
            <FieldBlock label="End Time (ISO/Text)">
              <Input
                value={(cfg.end_time as string) ?? ""}
                onChange={(e) => set({ end_time: e.target.value })}
                placeholder="2026-06-01T11:00:00Z"
                className="bg-slate-800 text-white"
              />
            </FieldBlock>
          </div>
          <FieldBlock label="Timezone">
            <Input
              value={(cfg.timezone as string) ?? "UTC"}
              onChange={(e) => set({ timezone: e.target.value })}
              placeholder="Asia/Kolkata"
              className="bg-slate-800 text-white"
            />
          </FieldBlock>
        </>
      )
    case "notion":
      return (
        <>
          <FieldBlock label="Notion Integration Token">
            <Input
              type="password"
              value={(cfg.api_key as string) ?? ""}
              onChange={(e) => set({ api_key: e.target.value })}
              placeholder="secret_..."
              className="bg-slate-800 text-white"
            />
          </FieldBlock>
          <FieldBlock label="Database ID">
            <Input
              value={(cfg.database_id as string) ?? ""}
              onChange={(e) => set({ database_id: e.target.value })}
              placeholder="e.g. 5d5a864..."
              className="bg-slate-800 text-white"
            />
          </FieldBlock>
          <FieldBlock label="Properties (Property Name → Value)">
            <KeyValueEditor
              values={(cfg.properties as Record<string, string>) ?? {}}
              onChange={(v) => set({ properties: v })}
              keyPlaceholder="Property Name"
              valuePlaceholder="Value (use Name for title property)"
            />
          </FieldBlock>
        </>
      )
    case "send_email":
      return (
        <>
          <FieldBlock label="To (Recipient Email)">
            <Input
              value={(cfg.to as string) ?? ""}
              onChange={(e) => set({ to: e.target.value })}
              placeholder="customer@example.com or {{contact.email}}"
              className="bg-slate-800 text-white"
            />
          </FieldBlock>
          <FieldBlock label="Subject">
            <Input
              value={(cfg.subject as string) ?? ""}
              onChange={(e) => set({ subject: e.target.value })}
              placeholder="Thanks for your message!"
              className="bg-slate-800 text-white"
            />
          </FieldBlock>
          <FieldBlock label="Body">
            <Textarea
              value={(cfg.body as string) ?? ""}
              onChange={(e) => set({ body: e.target.value })}
              placeholder="Hi {{contact.name}},\n\nWe received..."
              className="min-h-24 bg-slate-800 text-white text-xs"
            />
          </FieldBlock>
          <div className="mt-2 border-t border-slate-800 pt-2">
            <div className="text-[11px] font-semibold text-slate-400 mb-2">SMTP Settings (Optional)</div>
            <div className="space-y-2">
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <FieldBlock label="SMTP Host">
                    <Input
                      value={(cfg.smtp_host as string) ?? ""}
                      onChange={(e) => set({ smtp_host: e.target.value })}
                      placeholder="smtp.example.com"
                      className="bg-slate-800 text-xs text-white"
                    />
                  </FieldBlock>
                </div>
                <div>
                  <FieldBlock label="Port">
                    <Input
                      type="number"
                      value={(cfg.smtp_port as number) ?? 587}
                      onChange={(e) => set({ smtp_port: Number(e.target.value) })}
                      placeholder="587"
                      className="bg-slate-800 text-xs text-white"
                    />
                  </FieldBlock>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <FieldBlock label="SMTP Username">
                  <Input
                    value={(cfg.smtp_user as string) ?? ""}
                    onChange={(e) => set({ smtp_user: e.target.value })}
                    placeholder="user@example.com"
                    className="bg-slate-800 text-xs text-white"
                  />
                </FieldBlock>
                <FieldBlock label="SMTP Password">
                  <Input
                    type="password"
                    value={(cfg.smtp_pass as string) ?? ""}
                    onChange={(e) => set({ smtp_pass: e.target.value })}
                    placeholder="password"
                    className="bg-slate-800 text-xs text-white"
                  />
                </FieldBlock>
              </div>
            </div>
          </div>
        </>
      )
    case "send_admin_alert":
      return (
        <>
          <FieldBlock label="Admin Phone Number">
            <Input
              value={(cfg.admin_phone as string) ?? ""}
              onChange={(e) => set({ admin_phone: e.target.value })}
              placeholder="+1234567890"
              className="bg-slate-800 text-white"
            />
          </FieldBlock>
          <FieldBlock label="Alert Message">
            <Textarea
              value={(cfg.alert_message as string) ?? ""}
              onChange={(e) => set({ alert_message: e.target.value })}
              placeholder="Critical: Contact {{contact.name}} just messaged with: {{message.text}}"
              className="min-h-20 bg-slate-800 text-white text-xs"
            />
          </FieldBlock>
        </>
      )
    default:
      return null
  }
}

function FieldBlock({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="mb-2 last:mb-0">
      <label className="mb-1 block text-xs font-medium text-slate-400">{label}</label>
      {children}
    </div>
  )
}

function previewFor(step: BuilderStep): string {
  switch (step.step_type) {
    case "send_message":
      return (step.step_config.text as string) || "no text yet"
    case "send_template":
      return (step.step_config.template_name as string) || "pick a template"
    case "wait":
      return `${step.step_config.amount ?? "?"} ${step.step_config.unit ?? ""}`
    case "condition":
      return `when ${step.step_config.subject ?? "?"}`
    case "send_webhook":
      return (step.step_config.url as string) || "no url"
    case "ai_chatbot":
      return (step.step_config.system_prompt as string)?.slice(0, 40) || "configure AI persona"
    case "google_sheets":
      return `Append to sheet: ${step.step_config.sheet_name || "Sheet1"}`
    case "google_calendar":
      return `Create event: ${step.step_config.summary || "Untitled"}`
    case "notion":
      return `Add Notion page to database`
    case "send_email":
      return `Send email to: ${step.step_config.to || "no recipient"}`
    case "send_admin_alert":
      return `Alert to phone: ${step.step_config.admin_phone || "no phone"}`
    default:
      return ""
  }
}

// ------------------------------------------------------------
// Tree mutation helpers
// ------------------------------------------------------------

function insertAt(
  steps: BuilderStep[],
  parent: ParentScope,
  index: number,
  node: BuilderStep,
): BuilderStep[] {
  if (parent.kind === "root") {
    const copy = [...steps]
    copy.splice(index, 0, node)
    return copy
  }
  return steps.map((s) => {
    if (s.cid !== parent.parentCid || !s.branches) return s
    const list = [...s.branches[parent.branch]]
    list.splice(index, 0, node)
    return { ...s, branches: { ...s.branches, [parent.branch]: list } }
  })
}

function mapAtPath(
  steps: BuilderStep[],
  path: StepPath,
  updater: (s: BuilderStep) => BuilderStep,
): BuilderStep[] {
  if (path.length === 0) return steps
  const head = path[0]
  const rest = path.slice(1)

  if (head.kind === "root") {
    return steps.map((s, i) => {
      if (i !== head.index) return s
      return rest.length === 0
        ? updater(s)
        : { ...s, branches: walkBranches(s.branches, rest, updater) }
    })
  }
  return steps.map((s) => {
    if (s.cid !== head.parentCid || !s.branches) return s
    const bucket = s.branches[head.branch]
    const updated = bucket.map((child, i) => {
      if (i !== head.index) return child
      return rest.length === 0
        ? updater(child)
        : { ...child, branches: walkBranches(child.branches, rest, updater) }
    })
    return { ...s, branches: { ...s.branches, [head.branch]: updated } }
  })
}

function walkBranches(
  branches: BuilderStep["branches"],
  path: StepPath,
  updater: (s: BuilderStep) => BuilderStep,
): BuilderStep["branches"] {
  if (!branches) return branches
  const head = path[0]
  if (head.kind !== "branch") return branches
  const bucket = branches[head.branch]
  const rest = path.slice(1)
  const updated = bucket.map((child, i) => {
    if (i !== head.index) return child
    return rest.length === 0
      ? updater(child)
      : { ...child, branches: walkBranches(child.branches, rest, updater) }
  })
  return { ...branches, [head.branch]: updated }
}

function removeAt(steps: BuilderStep[], path: StepPath): BuilderStep[] {
  if (path.length === 0) return steps
  const head = path[0]
  const rest = path.slice(1)
  if (head.kind === "root") {
    if (rest.length === 0) return steps.filter((_, i) => i !== head.index)
    return steps.map((s, i) =>
      i !== head.index ? s : { ...s, branches: removeFromBranches(s.branches, rest) },
    )
  }
  return steps.map((s) => {
    if (s.cid !== head.parentCid || !s.branches) return s
    const bucket = s.branches[head.branch]
    const next =
      rest.length === 0
        ? bucket.filter((_, i) => i !== head.index)
        : bucket.map((child, i) =>
            i !== head.index
              ? child
              : { ...child, branches: removeFromBranches(child.branches, rest) },
          )
    return { ...s, branches: { ...s.branches, [head.branch]: next } }
  })
}

function removeFromBranches(
  branches: BuilderStep["branches"],
  path: StepPath,
): BuilderStep["branches"] {
  if (!branches) return branches
  const head = path[0]
  if (head.kind !== "branch") return branches
  const rest = path.slice(1)
  const bucket = branches[head.branch]
  const next =
    rest.length === 0
      ? bucket.filter((_, i) => i !== head.index)
      : bucket.map((child, i) =>
          i !== head.index
            ? child
            : { ...child, branches: removeFromBranches(child.branches, rest) },
        )
  return { ...branches, [head.branch]: next }
}

function moveAt(
  steps: BuilderStep[],
  path: StepPath,
  direction: -1 | 1,
): BuilderStep[] {
  if (path.length === 0) return steps
  const head = path[0]
  const rest = path.slice(1)
  const swap = <T,>(arr: T[], i: number) => {
    const j = i + direction
    if (j < 0 || j >= arr.length) return arr
    const copy = [...arr]
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
    return copy
  }
  if (head.kind === "root") {
    if (rest.length === 0) return swap(steps, head.index)
    return steps.map((s, i) =>
      i !== head.index ? s : { ...s, branches: moveInBranches(s.branches, rest, direction) },
    )
  }
  return steps.map((s) => {
    if (s.cid !== head.parentCid || !s.branches) return s
    const bucket = s.branches[head.branch]
    const next = rest.length === 0 ? swap(bucket, head.index) : bucket
    return { ...s, branches: { ...s.branches, [head.branch]: next } }
  })
}

function moveInBranches(
  branches: BuilderStep["branches"],
  path: StepPath,
  direction: -1 | 1,
): BuilderStep["branches"] {
  if (!branches) return branches
  const head = path[0]
  if (head.kind !== "branch") return branches
  const rest = path.slice(1)
  const bucket = branches[head.branch]
  const swap = <T,>(arr: T[], i: number) => {
    const j = i + direction
    if (j < 0 || j >= arr.length) return arr
    const copy = [...arr]
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
    return copy
  }
  const next = rest.length === 0 ? swap(bucket, head.index) : bucket
  return { ...branches, [head.branch]: next }
}

// ------------------------------------------------------------
// Serialize builder tree → API payload (flattened shape)
// ------------------------------------------------------------

interface ApiStep {
  step_type: string
  step_config: Record<string, unknown>
  branches?: { yes?: ApiStep[]; no?: ApiStep[] }
}

export function toApiSteps(steps: BuilderStep[]): ApiStep[] {
  return steps.map((s) => ({
    step_type: s.step_type,
    step_config: s.step_config,
    branches: s.branches
      ? { yes: toApiSteps(s.branches.yes), no: toApiSteps(s.branches.no) }
      : undefined,
  }))
}

/**
 * Convert server-returned step tree (from loadStepsTree) into the
 * builder-local shape with client ids.
 */
export interface ServerStepNode {
  id: string
  step_type: string
  step_config: Record<string, unknown>
  branches: { yes: ServerStepNode[]; no: ServerStepNode[] }
}

export function fromServerSteps(nodes: ServerStepNode[]): BuilderStep[] {
  return nodes.map((n) => ({
    cid: cid(),
    step_type: n.step_type as AutomationStepType,
    step_config: n.step_config ?? {},
    branches:
      n.step_type === "condition"
        ? {
            yes: fromServerSteps(n.branches?.yes ?? []),
            no: fromServerSteps(n.branches?.no ?? []),
          }
        : undefined,
  }))
}

// ------------------------------------------------------------
// Key-Value Editor for spreadsheet rows and Notion properties
// ------------------------------------------------------------
function KeyValueEditor({
  values,
  onChange,
  keyPlaceholder = "Key",
  valuePlaceholder = "Value",
}: {
  values: Record<string, string>
  onChange: (v: Record<string, string>) => void
  keyPlaceholder?: string
  valuePlaceholder?: string
}) {
  const [newKey, setNewKey] = useState("")
  const [newValue, setNewValue] = useState("")

  const addPair = () => {
    if (!newKey.trim()) return
    onChange({ ...values, [newKey.trim()]: newValue })
    setNewKey("")
    setNewValue("")
  }

  const removePair = (k: string) => {
    const copy = { ...values }
    delete copy[k]
    onChange(copy)
  }

  return (
    <div className="space-y-2">
      {Object.keys(values).length > 0 && (
        <div className="space-y-1 rounded-md border border-slate-800 bg-slate-950/50 p-2">
          {Object.entries(values).map(([k, v]) => (
            <div key={k} className="flex items-center gap-2 text-xs">
              <span className="font-mono font-medium text-slate-300 min-w-[80px] truncate">{k}:</span>
              <span className="flex-1 text-slate-400 truncate">{v}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-slate-500 hover:text-red-400"
                onClick={() => removePair(k)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <Input
          placeholder={keyPlaceholder}
          value={newKey}
          onChange={(e) => setNewKey(e.target.value)}
          className="h-8 bg-slate-800 text-xs text-white"
        />
        <Input
          placeholder={valuePlaceholder}
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          className="h-8 bg-slate-800 text-xs text-white"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addPair}
          className="h-8 border-slate-700 bg-slate-800 hover:bg-slate-700 text-xs text-slate-300"
        >
          Add
        </Button>
      </div>
    </div>
  )
}
