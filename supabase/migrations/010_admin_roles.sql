-- ============================================================
-- Migration 010: Admin role support
-- Adds a helper function to check if the current user is an
-- admin, and updates RLS policies on all key tables so admins
-- can read (and manage) data across every user's workspace.
-- ============================================================

-- Helper: returns TRUE when the calling user has role = 'admin'.
-- SECURITY DEFINER so it can read `profiles` regardless of the
-- caller's own RLS context (profiles RLS limits to own row).
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE user_id = auth.uid() AND role = 'admin'
  );
$$;

ALTER FUNCTION public.is_admin() OWNER TO postgres;

-- ============================================================
-- PROFILES — admins can view all profiles
-- ============================================================
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = user_id OR public.is_admin());

-- ============================================================
-- CONTACTS — admins can manage all contacts
-- ============================================================
DROP POLICY IF EXISTS "Users can manage own contacts" ON contacts;
CREATE POLICY "Users can manage own contacts" ON contacts
  FOR ALL USING (auth.uid() = user_id OR public.is_admin());

-- ============================================================
-- TAGS — admins can manage all tags
-- ============================================================
DROP POLICY IF EXISTS "Users can manage own tags" ON tags;
CREATE POLICY "Users can manage own tags" ON tags
  FOR ALL USING (auth.uid() = user_id OR public.is_admin());

-- ============================================================
-- CONTACT_TAGS — admins can manage all
-- ============================================================
DROP POLICY IF EXISTS "Users can manage contact tags" ON contact_tags;
CREATE POLICY "Users can manage contact tags" ON contact_tags
  FOR ALL USING (
    EXISTS (SELECT 1 FROM contacts WHERE contacts.id = contact_tags.contact_id AND contacts.user_id = auth.uid())
    OR public.is_admin()
  );

-- ============================================================
-- CUSTOM_FIELDS — admins can manage all
-- ============================================================
DROP POLICY IF EXISTS "Users can manage own custom fields" ON custom_fields;
CREATE POLICY "Users can manage own custom fields" ON custom_fields
  FOR ALL USING (auth.uid() = user_id OR public.is_admin());

-- ============================================================
-- CONTACT_CUSTOM_VALUES — admins can manage all
-- ============================================================
DROP POLICY IF EXISTS "Users can manage custom values" ON contact_custom_values;
CREATE POLICY "Users can manage custom values" ON contact_custom_values
  FOR ALL USING (
    EXISTS (SELECT 1 FROM contacts WHERE contacts.id = contact_custom_values.contact_id AND contacts.user_id = auth.uid())
    OR public.is_admin()
  );

-- ============================================================
-- CONTACT_NOTES — admins can manage all
-- ============================================================
DROP POLICY IF EXISTS "Users can manage own notes" ON contact_notes;
CREATE POLICY "Users can manage own notes" ON contact_notes
  FOR ALL USING (auth.uid() = user_id OR public.is_admin());

-- ============================================================
-- CONVERSATIONS — admins can manage all
-- ============================================================
DROP POLICY IF EXISTS "Users can manage own conversations" ON conversations;
CREATE POLICY "Users can manage own conversations" ON conversations
  FOR ALL USING (auth.uid() = user_id OR public.is_admin());

-- ============================================================
-- MESSAGES — admins can view all
-- ============================================================
DROP POLICY IF EXISTS "Users can view own messages" ON messages;
CREATE POLICY "Users can view own messages" ON messages
  FOR ALL USING (
    EXISTS (SELECT 1 FROM conversations WHERE conversations.id = messages.conversation_id AND conversations.user_id = auth.uid())
    OR public.is_admin()
  );

-- ============================================================
-- WHATSAPP_CONFIG — admins can view all
-- ============================================================
DROP POLICY IF EXISTS "Users can manage own config" ON whatsapp_config;
CREATE POLICY "Users can manage own config" ON whatsapp_config
  FOR ALL USING (auth.uid() = user_id OR public.is_admin());

-- ============================================================
-- MESSAGE_TEMPLATES — admins can manage all
-- ============================================================
DROP POLICY IF EXISTS "Users can manage own templates" ON message_templates;
CREATE POLICY "Users can manage own templates" ON message_templates
  FOR ALL USING (auth.uid() = user_id OR public.is_admin());

-- ============================================================
-- PIPELINES — admins can manage all
-- ============================================================
DROP POLICY IF EXISTS "Users can manage own pipelines" ON pipelines;
CREATE POLICY "Users can manage own pipelines" ON pipelines
  FOR ALL USING (auth.uid() = user_id OR public.is_admin());

-- ============================================================
-- PIPELINE_STAGES — admins can manage all
-- ============================================================
DROP POLICY IF EXISTS "Users can manage pipeline stages" ON pipeline_stages;
CREATE POLICY "Users can manage pipeline stages" ON pipeline_stages
  FOR ALL USING (
    EXISTS (SELECT 1 FROM pipelines WHERE pipelines.id = pipeline_stages.pipeline_id AND pipelines.user_id = auth.uid())
    OR public.is_admin()
  );

-- ============================================================
-- DEALS — admins can manage all
-- ============================================================
DROP POLICY IF EXISTS "Users can manage own deals" ON deals;
CREATE POLICY "Users can manage own deals" ON deals
  FOR ALL USING (auth.uid() = user_id OR public.is_admin());

-- ============================================================
-- BROADCASTS — admins can manage all
-- ============================================================
DROP POLICY IF EXISTS "Users can manage own broadcasts" ON broadcasts;
CREATE POLICY "Users can manage own broadcasts" ON broadcasts
  FOR ALL USING (auth.uid() = user_id OR public.is_admin());

-- ============================================================
-- BROADCAST_RECIPIENTS — admins can manage all
-- ============================================================
DROP POLICY IF EXISTS "Users can manage broadcast recipients" ON broadcast_recipients;
CREATE POLICY "Users can manage broadcast recipients" ON broadcast_recipients
  FOR ALL USING (
    EXISTS (SELECT 1 FROM broadcasts WHERE broadcasts.id = broadcast_recipients.broadcast_id AND broadcasts.user_id = auth.uid())
    OR public.is_admin()
  );
