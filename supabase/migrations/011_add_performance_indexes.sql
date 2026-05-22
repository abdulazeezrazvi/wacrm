-- Indexes for message queries (range lookups)
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created ON messages(conversation_id, created_at);

-- Composite indexes for RLS user_id filtering + ordering
CREATE INDEX IF NOT EXISTS idx_contacts_user_created ON contacts(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_user_created ON conversations(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(status);
CREATE INDEX IF NOT EXISTS idx_deals_user_updated ON deals(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_deals_status ON deals(status);
CREATE INDEX IF NOT EXISTS idx_broadcasts_user_created ON broadcasts(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_automation_logs_user_created ON automation_logs(user_id, created_at DESC);
