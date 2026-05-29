-- Migration 014: Add n8n integration columns to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS n8n_webhook_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS n8n_enabled BOOLEAN DEFAULT FALSE;
