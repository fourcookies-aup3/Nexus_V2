/*
# NEXUS Memory System + Extended Runtime Tables

## Overview
Creates the 6-tier memory system with pgvector, plus extended runtime tables:
- memory_semantic: knowledge with vector embeddings for similarity search
- memory_episodic: past events and interactions
- memory_procedural: learned workflows and procedures
- memory_preferences: user preferences
- memory_working: expiring context for active tasks
- entities: entity memory (people, projects, organizations with relationships)
- agent_execution_logs: observability — every agent thought/action/result traceable
- file_changes: real file monitoring log (from watchdog/watchfiles)
- applications: application runtime tracking (build/launch/status)
- jobs: background job queue for long-running tasks

## Security
- RLS enabled on all tables with anon + authenticated access
*/

-- ============================================================
-- MEMORY: SEMANTIC (with pgvector)
-- ============================================================
CREATE TABLE IF NOT EXISTS memory_semantic (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content text NOT NULL,
  embedding vector(1536),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  agent_id uuid REFERENCES agents(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE memory_semantic ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_memory_semantic" ON memory_semantic;
CREATE POLICY "select_memory_semantic" ON memory_semantic FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "insert_memory_semantic" ON memory_semantic;
CREATE POLICY "insert_memory_semantic" ON memory_semantic FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_memory_semantic" ON memory_semantic;
CREATE POLICY "update_memory_semantic" ON memory_semantic FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_memory_semantic" ON memory_semantic;
CREATE POLICY "delete_memory_semantic" ON memory_semantic FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_memory_semantic_embedding ON memory_semantic
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- ============================================================
-- MEMORY: EPISODIC
-- ============================================================
CREATE TABLE IF NOT EXISTS memory_episodic (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  description text NOT NULL,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  agent_id uuid REFERENCES agents(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE memory_episodic ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_memory_episodic" ON memory_episodic;
CREATE POLICY "select_memory_episodic" ON memory_episodic FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "insert_memory_episodic" ON memory_episodic;
CREATE POLICY "insert_memory_episodic" ON memory_episodic FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_memory_episodic" ON memory_episodic;
CREATE POLICY "update_memory_episodic" ON memory_episodic FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_memory_episodic" ON memory_episodic;
CREATE POLICY "delete_memory_episodic" ON memory_episodic FOR DELETE
  TO anon, authenticated USING (true);

-- ============================================================
-- MEMORY: PROCEDURAL
-- ============================================================
CREATE TABLE IF NOT EXISTS memory_procedural (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  procedure_name text NOT NULL,
  steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  trigger_conditions text NOT NULL DEFAULT '',
  success_rate numeric NOT NULL DEFAULT 0.0,
  times_executed int NOT NULL DEFAULT 0,
  agent_id uuid REFERENCES agents(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE memory_procedural ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_memory_procedural" ON memory_procedural;
CREATE POLICY "select_memory_procedural" ON memory_procedural FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "insert_memory_procedural" ON memory_procedural;
CREATE POLICY "insert_memory_procedural" ON memory_procedural FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_memory_procedural" ON memory_procedural;
CREATE POLICY "update_memory_procedural" ON memory_procedural FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_memory_procedural" ON memory_procedural;
CREATE POLICY "delete_memory_procedural" ON memory_procedural FOR DELETE
  TO anon, authenticated USING (true);

-- ============================================================
-- MEMORY: PREFERENCES
-- ============================================================
CREATE TABLE IF NOT EXISTS memory_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  preference_key text NOT NULL UNIQUE,
  preference_value text NOT NULL,
  category text NOT NULL DEFAULT 'general',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE memory_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_memory_preferences" ON memory_preferences;
CREATE POLICY "select_memory_preferences" ON memory_preferences FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "insert_memory_preferences" ON memory_preferences;
CREATE POLICY "insert_memory_preferences" ON memory_preferences FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_memory_preferences" ON memory_preferences;
CREATE POLICY "update_memory_preferences" ON memory_preferences FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_memory_preferences" ON memory_preferences;
CREATE POLICY "delete_memory_preferences" ON memory_preferences FOR DELETE
  TO anon, authenticated USING (true);

-- ============================================================
-- MEMORY: WORKING (expiring context)
-- ============================================================
CREATE TABLE IF NOT EXISTS memory_working (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid REFERENCES agents(id) ON DELETE CASCADE,
  task_id uuid,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '1 hour'),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE memory_working ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_memory_working" ON memory_working;
CREATE POLICY "select_memory_working" ON memory_working FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "insert_memory_working" ON memory_working;
CREATE POLICY "insert_memory_working" ON memory_working FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_memory_working" ON memory_working;
CREATE POLICY "update_memory_working" ON memory_working FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_memory_working" ON memory_working;
CREATE POLICY "delete_memory_working" ON memory_working FOR DELETE
  TO anon, authenticated USING (true);

-- ============================================================
-- ENTITIES (Entity Memory)
-- ============================================================
CREATE TABLE IF NOT EXISTS entities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  entity_type text NOT NULL DEFAULT 'person' CHECK (entity_type IN ('person','organization','project','concept','location','event','other')),
  attributes jsonb NOT NULL DEFAULT '{}'::jsonb,
  relationships jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE entities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_entities" ON entities;
CREATE POLICY "select_entities" ON entities FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "insert_entities" ON entities;
CREATE POLICY "insert_entities" ON entities FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_entities" ON entities;
CREATE POLICY "update_entities" ON entities FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_entities" ON entities;
CREATE POLICY "delete_entities" ON entities FOR DELETE
  TO anon, authenticated USING (true);

-- ============================================================
-- AGENT EXECUTION LOGS (Observability)
-- ============================================================
CREATE TABLE IF NOT EXISTS agent_execution_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid REFERENCES agents(id) ON DELETE SET NULL,
  thought_summary text NOT NULL DEFAULT '',
  action text NOT NULL DEFAULT '',
  tool text NOT NULL DEFAULT '',
  input jsonb NOT NULL DEFAULT '{}'::jsonb,
  output jsonb NOT NULL DEFAULT '{}'::jsonb,
  duration_ms int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE agent_execution_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_agent_execution_logs" ON agent_execution_logs;
CREATE POLICY "select_agent_execution_logs" ON agent_execution_logs FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "insert_agent_execution_logs" ON agent_execution_logs;
CREATE POLICY "insert_agent_execution_logs" ON agent_execution_logs FOR INSERT
  TO anon, authenticated WITH CHECK (true);

-- ============================================================
-- FILE CHANGES (Real File Monitoring)
-- ============================================================
CREATE TABLE IF NOT EXISTS file_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid REFERENCES agents(id) ON DELETE SET NULL,
  workspace_path text NOT NULL DEFAULT '',
  file_path text NOT NULL,
  change_type text NOT NULL CHECK (change_type IN ('created','modified','deleted','renamed')),
  content_diff text NOT NULL DEFAULT '',
  file_size bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE file_changes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_file_changes" ON file_changes;
CREATE POLICY "select_file_changes" ON file_changes FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "insert_file_changes" ON file_changes;
CREATE POLICY "insert_file_changes" ON file_changes FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_file_changes" ON file_changes;
CREATE POLICY "update_file_changes" ON file_changes FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_file_changes" ON file_changes;
CREATE POLICY "delete_file_changes" ON file_changes FOR DELETE
  TO anon, authenticated USING (true);

-- ============================================================
-- APPLICATIONS (Runtime Manager)
-- ============================================================
CREATE TABLE IF NOT EXISTS applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid REFERENCES agents(id) ON DELETE SET NULL,
  name text NOT NULL,
  app_type text NOT NULL DEFAULT 'web' CHECK (app_type IN ('web','game','desktop','python','node','script','mobile')),
  language text NOT NULL DEFAULT '',
  framework text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'building' CHECK (status IN ('building','running','stopped','error','completed')),
  start_command text NOT NULL DEFAULT '',
  port int,
  workspace_path text NOT NULL DEFAULT '',
  logs text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_applications" ON applications;
CREATE POLICY "select_applications" ON applications FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "insert_applications" ON applications;
CREATE POLICY "insert_applications" ON applications FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_applications" ON applications;
CREATE POLICY "update_applications" ON applications FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_applications" ON applications;
CREATE POLICY "delete_applications" ON applications FOR DELETE
  TO anon, authenticated USING (true);

-- ============================================================
-- JOBS (Background Job Queue)
-- ============================================================
CREATE TABLE IF NOT EXISTS jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  priority int NOT NULL DEFAULT 5,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','completed','failed','cancelled')),
  worker text,
  retry_count int NOT NULL DEFAULT 0,
  max_retries int NOT NULL DEFAULT 3,
  result jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz
);

ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_jobs" ON jobs;
CREATE POLICY "select_jobs" ON jobs FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "insert_jobs" ON jobs;
CREATE POLICY "insert_jobs" ON jobs FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_jobs" ON jobs;
CREATE POLICY "update_jobs" ON jobs FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_jobs" ON jobs;
CREATE POLICY "delete_jobs" ON jobs FOR DELETE
  TO anon, authenticated USING (true);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_memory_episodic_agent ON memory_episodic (agent_id);
CREATE INDEX IF NOT EXISTS idx_memory_episodic_type ON memory_episodic (event_type);
CREATE INDEX IF NOT EXISTS idx_memory_working_expires ON memory_working (expires_at);
CREATE INDEX IF NOT EXISTS idx_entities_name ON entities (name);
CREATE INDEX IF NOT EXISTS idx_entities_type ON entities (entity_type);
CREATE INDEX IF NOT EXISTS idx_agent_execution_logs_agent ON agent_execution_logs (agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_execution_logs_created ON agent_execution_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_file_changes_agent ON file_changes (agent_id);
CREATE INDEX IF NOT EXISTS idx_file_changes_created ON file_changes (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_applications_status ON applications (status);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs (status);
CREATE INDEX IF NOT EXISTS idx_jobs_priority ON jobs (priority);
