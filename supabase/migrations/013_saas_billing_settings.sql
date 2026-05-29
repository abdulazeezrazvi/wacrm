-- Migration 013: SaaS Billing Settings & Promo Codes Config
-- Exposes active pricing plans and promo codes to the landing page while protecting edits behind admin role.

CREATE TABLE IF NOT EXISTS public.saas_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  starter_price NUMERIC NOT NULL DEFAULT 499,
  pro_price NUMERIC NOT NULL DEFAULT 999,
  free_code TEXT DEFAULT 'LIFETIMEFREE',
  discount_code TEXT DEFAULT 'CRM50',
  discount_percentage NUMERIC DEFAULT 50,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row-Level Security
ALTER TABLE public.saas_settings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Allow public read saas_settings" ON public.saas_settings;
DROP POLICY IF EXISTS "Allow admin write saas_settings" ON public.saas_settings;

-- 1. Read Policy: Anyone (even unauthenticated visitors browsing the landing page) can read current pricing/codes.
CREATE POLICY "Allow public read saas_settings" ON public.saas_settings
  FOR SELECT USING (true);

-- 2. Write Policy: Only Admin users can create, update, or delete settings rows.
CREATE POLICY "Allow admin write saas_settings" ON public.saas_settings
  FOR ALL USING (public.is_admin());

-- Seed the initial row if not already present.
-- We seed a single static configuration row with standard defaults.
INSERT INTO public.saas_settings (starter_price, pro_price, free_code, discount_code, discount_percentage)
VALUES (499, 999, 'LIFETIMEFREE', 'CRM50', 50)
ON CONFLICT DO NOTHING;
