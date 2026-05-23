-- ============================================================
-- Migration 012: Optimize RLS policies for performance
-- ============================================================

-- 1. Optimize is_admin() function with transaction-local cache
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  val TEXT;
  res BOOLEAN;
BEGIN
  -- Check transaction-local cache
  val := current_setting('request.is_admin_cached', true);
  IF val IS NOT NULL THEN
    RETURN val = 'true';
  END IF;

  -- Not cached, execute query
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE user_id = auth.uid() AND role = 'admin'
  ) INTO res;

  -- Cache for the duration of the current transaction
  PERFORM set_config('request.is_admin_cached', CASE WHEN res THEN 'true' ELSE 'false' END, true);

  RETURN res;
END;
$$;

-- 2. Update policies to put public.is_admin() first for short-circuiting

-- PROFILES
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (public.is_admin() OR auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (public.is_admin() OR auth.uid() = user_id);

-- CONTACTS
DROP POLICY IF EXISTS "Users can manage own contacts" ON contacts;
CREATE POLICY "Users can manage own contacts" ON contacts
  FOR ALL USING (public.is_admin() OR auth.uid() = user_id);

-- TAGS
DROP POLICY IF EXISTS "Users can manage own tags" ON tags;
CREATE POLICY "Users can manage own tags" ON tags
  FOR ALL USING (public.is_admin() OR auth.uid() = user_id);

-- CONTACT_TAGS
DROP POLICY IF EXISTS "Users can manage contact tags" ON contact_tags;
CREATE POLICY "Users can manage contact tags" ON contact_tags
  FOR ALL USING (
    public.is_admin() OR
    EXISTS (SELECT 1 FROM contacts WHERE contacts.id = contact_tags.contact_id AND contacts.user_id = auth.uid())
  );

-- CUSTOM_FIELDS
DROP POLICY IF EXISTS "Users can manage own custom fields" ON custom_fields;
CREATE POLICY "Users can manage own custom fields" ON custom_fields
  FOR ALL USING (public.is_admin() OR auth.uid() = user_id);

-- CONTACT_CUSTOM_VALUES
DROP POLICY IF EXISTS "Users can manage custom values" ON contact_custom_values;
CREATE POLICY "Users can manage custom values" ON contact_custom_values
  FOR ALL USING (
    public.is_admin() OR
    EXISTS (SELECT 1 FROM contacts WHERE contacts.id = contact_custom_values.contact_id AND contacts.user_id = auth.uid())
  );

-- CONTACT_NOTES
DROP POLICY IF EXISTS "Users can manage own notes" ON contact_notes;
CREATE POLICY "Users can manage own notes" ON contact_notes
  FOR ALL USING (public.is_admin() OR auth.uid() = user_id);

-- CONVERSATIONS
DROP POLICY IF EXISTS "Users can manage own conversations" ON conversations;
CREATE POLICY "Users can manage own conversations" ON conversations
  FOR ALL USING (public.is_admin() OR auth.uid() = user_id);

-- MESSAGES
DROP POLICY IF EXISTS "Users can view own messages" ON messages;
CREATE POLICY "Users can view own messages" ON messages
  FOR ALL USING (
    public.is_admin() OR
    EXISTS (SELECT 1 FROM conversations WHERE conversations.id = messages.conversation_id AND conversations.user_id = auth.uid())
  );

-- WHATSAPP_CONFIG
DROP POLICY IF EXISTS "Users can manage own config" ON whatsapp_config;
CREATE POLICY "Users can manage own config" ON whatsapp_config
  FOR ALL USING (public.is_admin() OR auth.uid() = user_id);

-- MESSAGE_TEMPLATES
DROP POLICY IF EXISTS "Users can manage own templates" ON message_templates;
CREATE POLICY "Users can manage own templates" ON message_templates
  FOR ALL USING (public.is_admin() OR auth.uid() = user_id);

-- PIPELINES
DROP POLICY IF EXISTS "Users can manage own pipelines" ON pipelines;
CREATE POLICY "Users can manage own pipelines" ON pipelines
  FOR ALL USING (public.is_admin() OR auth.uid() = user_id);

-- PIPELINE_STAGES
DROP POLICY IF EXISTS "Users can manage pipeline stages" ON pipeline_stages;
CREATE POLICY "Users can manage pipeline stages" ON pipeline_stages
  FOR ALL USING (
    public.is_admin() OR
    EXISTS (SELECT 1 FROM pipelines WHERE pipelines.id = pipeline_stages.pipeline_id AND pipelines.user_id = auth.uid())
  );

-- DEALS
DROP POLICY IF EXISTS "Users can manage own deals" ON deals;
CREATE POLICY "Users can manage own deals" ON deals
  FOR ALL USING (public.is_admin() OR auth.uid() = user_id);

-- BROADCASTS
DROP POLICY IF EXISTS "Users can manage own broadcasts" ON broadcasts;
CREATE POLICY "Users can manage own broadcasts" ON broadcasts
  FOR ALL USING (public.is_admin() OR auth.uid() = user_id);

-- BROADCAST_RECIPIENTS
DROP POLICY IF EXISTS "Users can manage broadcast recipients" ON broadcast_recipients;
CREATE POLICY "Users can manage broadcast recipients" ON broadcast_recipients
  FOR ALL USING (
    public.is_admin() OR
    EXISTS (SELECT 1 FROM broadcasts WHERE broadcasts.id = broadcast_recipients.broadcast_id AND broadcasts.user_id = auth.uid())
  );

-- AUTOMATIONS
DROP POLICY IF EXISTS "Users can manage own automations" ON automations;
CREATE POLICY "Users can manage own automations" ON automations
  FOR ALL USING (public.is_admin() OR auth.uid() = user_id);

-- AUTOMATION_STEPS
DROP POLICY IF EXISTS "Users can manage steps of own automations" ON automation_steps;
CREATE POLICY "Users can manage steps of own automations" ON automation_steps
  FOR ALL USING (
    public.is_admin() OR
    EXISTS (SELECT 1 FROM automations a WHERE a.id = automation_steps.automation_id AND a.user_id = auth.uid())
  );

-- AUTOMATION_LOGS
DROP POLICY IF EXISTS "Users can view own automation logs" ON automation_logs;
CREATE POLICY "Users can view own automation logs" ON automation_logs
  FOR ALL USING (public.is_admin() OR auth.uid() = user_id);
