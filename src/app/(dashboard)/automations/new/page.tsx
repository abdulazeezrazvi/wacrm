"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Loader2 } from "lucide-react"

import {
  AutomationBuilder,
  type BuilderInitial,
  type BuilderStep,
} from "@/components/automations/automation-builder"
import { AUTOMATION_TEMPLATES, type TemplateSlug } from "@/lib/automations/templates"
import { createClient } from "@/lib/supabase/client"
import type { AutomationStepType, AutomationTriggerType } from "@/types"

export default function NewAutomationPage() {
  const params = useSearchParams()
  const templateParam = params.get("template")
  const [loading, setLoading] = useState(!!templateParam)
  const [initial, setInitial] = useState<BuilderInitial>({
    name: "",
    description: "",
    trigger_type: "new_message_received",
    trigger_config: {},
    is_active: false,
    steps: [],
  })

  useEffect(() => {
    async function loadTemplate() {
      if (!templateParam) {
        setLoading(false)
        return
      }

      const supabase = createClient()
      let name = ""
      let description = ""
      let trigger_type: AutomationTriggerType = "new_message_received"
      let trigger_config: Record<string, unknown> = {}
      let rawSteps: any[] = []

      // 1. Fetch template definition (either static library or dynamic global_templates table)
      const isStaticSlug = Object.keys(AUTOMATION_TEMPLATES).includes(templateParam)

      if (isStaticSlug) {
        const t = AUTOMATION_TEMPLATES[templateParam as TemplateSlug]
        name = t.name
        description = t.description
        trigger_type = t.trigger_type
        trigger_config = t.trigger_config as Record<string, unknown>
        rawSteps = t.steps.map((seed, idx) => ({
          index: idx,
          step_type: seed.step_type,
          step_config: seed.step_config as Record<string, unknown>,
          branch: seed.branch ?? null,
          parent_index: seed.parent_index ?? null,
        }))
      } else {
        // It's a dynamic template UUID from the global_templates table
        try {
          const { data, error } = await supabase
            .from("global_templates")
            .select("*")
            .eq("id", templateParam)
            .maybeSingle()

          if (error) throw error
          if (data) {
            name = data.name
            description = data.description || ""
            trigger_type = data.trigger_type as AutomationTriggerType
            trigger_config = (data.trigger_config || {}) as Record<string, unknown>
            
            // Database stores steps as JSON array
            const dbSteps = (data.steps || []) as any[]
            rawSteps = dbSteps.map((s: any, idx: number) => ({
              index: idx,
              step_type: s.step_type,
              step_config: s.step_config || {},
              branch: s.branch ?? null,
              parent_index: s.parent_index ?? null,
            }))
          } else {
            console.error("Template not found in global_templates table:", templateParam)
          }
        } catch (err) {
          console.error("Failed to load global template:", err)
        }
      }

      // 2. Fetch user's pipelines/stages to auto-configure CRM steps
      let defaultPipelineId = ""
      let defaultStageId = ""

      try {
        const { data: pipelines } = await supabase
          .from("pipelines")
          .select("id")
          .order("created_at")
          .limit(1)

        if (pipelines && pipelines.length > 0) {
          defaultPipelineId = pipelines[0].id

          const { data: stages } = await supabase
            .from("pipeline_stages")
            .select("id")
            .eq("pipeline_id", defaultPipelineId)
            .order("position")
            .limit(1)

          if (stages && stages.length > 0) {
            defaultStageId = stages[0].id
          }
        }
      } catch (err) {
        console.error("Failed to fetch default pipelines for template auto-fill:", err)
      }

      // 3. Map steps and replace empty/placeholder pipeline_id and stage_id values
      const resolvedSteps = rawSteps.map((seed) => {
        const step_config = { ...seed.step_config } as Record<string, any>
        
        // Auto-fill user's default pipeline and stage if required by the step type
        if (seed.step_type === "create_deal") {
          if (!step_config.pipeline_id && defaultPipelineId) {
            step_config.pipeline_id = defaultPipelineId
          }
          if (!step_config.stage_id && defaultStageId) {
            step_config.stage_id = defaultStageId
          }
        }

        return {
          index: seed.index,
          step_type: seed.step_type as AutomationStepType,
          step_config,
          branch: seed.branch,
          parent_index: seed.parent_index,
        }
      })

      const steps = expandFromSeeds(resolvedSteps)

      setInitial({
        name,
        description,
        trigger_type,
        trigger_config,
        is_active: false,
        steps,
      })
      setLoading(false)
    }

    loadTemplate()
  }, [templateParam])

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
          <p className="text-sm text-slate-400">Auto-configuring your template...</p>
        </div>
      </div>
    )
  }

  return <AutomationBuilder initial={initial} />
}

interface SeedRow {
  index: number
  step_type: AutomationStepType
  step_config: Record<string, unknown>
  branch: "yes" | "no" | null
  parent_index: number | null
}

function uid(): string {
  return (
    "c_" +
    (typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36))
  )
}

/** Template seeds are flat with parent_index references. Expand into the
 *  builder's nested tree, preserving order within each scope. */
function expandFromSeeds(rows: SeedRow[]): BuilderStep[] {
  const nodes: BuilderStep[] = rows.map((r) => ({
    cid: uid(),
    step_type: r.step_type,
    step_config: r.step_config,
    branches:
      r.step_type === "condition" ? { yes: [], no: [] } : undefined,
  }))
  const roots: BuilderStep[] = []
  rows.forEach((r, i) => {
    if (r.parent_index == null) {
      roots.push(nodes[i])
      return
    }
    const parent = nodes[r.parent_index]
    if (!parent.branches) parent.branches = { yes: [], no: [] }
    parent.branches[r.branch ?? "yes"].push(nodes[i])
  })
  return roots
}
