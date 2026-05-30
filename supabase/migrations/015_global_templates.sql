-- Migration 015: Global dynamic templates for all users
CREATE TABLE IF NOT EXISTS public.global_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  trigger_type TEXT NOT NULL,
  trigger_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row-Level Security
ALTER TABLE public.global_templates ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Allow public read global_templates" ON public.global_templates;
DROP POLICY IF EXISTS "Allow admin manage global_templates" ON public.global_templates;

-- 1. Read Policy: All authenticated users can read templates
CREATE POLICY "Allow public read global_templates" ON public.global_templates
  FOR SELECT USING (auth.role() = 'authenticated');

-- 2. Write Policy: Only admin users can manage templates
CREATE POLICY "Allow admin manage global_templates" ON public.global_templates
  FOR ALL USING (public.is_admin());
