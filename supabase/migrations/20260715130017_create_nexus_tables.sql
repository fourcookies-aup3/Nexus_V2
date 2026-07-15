-- Nexus AI Employee tables

-- Chat messages table
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- System logs table
CREATE TABLE IF NOT EXISTS nexus_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level text NOT NULL CHECK (level IN ('info', 'warning', 'error', 'success')),
  message text NOT NULL,
  source text NOT NULL DEFAULT 'system',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE nexus_logs ENABLE ROW LEVEL SECURITY;

-- Messages policies (no-auth app: anon + authenticated can read/write their own)
CREATE POLICY "select_messages" ON messages FOR SELECT
  TO anon, authenticated USING (true);
CREATE POLICY "insert_messages" ON messages FOR INSERT
  TO anon, authenticated WITH CHECK (true);

-- Nexus logs policies
CREATE POLICY "select_nexus_logs" ON nexus_logs FOR SELECT
  TO anon, authenticated USING (true);
CREATE POLICY "insert_nexus_logs" ON nexus_logs FOR INSERT
  TO anon, authenticated WITH CHECK (true);

-- Index for ordering
CREATE INDEX idx_messages_created_at ON messages (created_at);
CREATE INDEX idx_nexus_logs_created_at ON nexus_logs (created_at);

-- Seed some initial system logs
INSERT INTO nexus_logs (level, message, source) VALUES
  ('success', 'NEXUS core initialized', 'boot'),
  ('info', 'Neural pathways online', 'neural'),
  ('info', 'Memory allocation: 2.4TB allocated', 'memory'),
  ('success', 'All subsystems operational', 'system'),
  ('info', 'Awaiting user interaction', 'interface');
