/*
# NEXUS Core Schema — Agents, Tasks, Commands, Events

## Overview
Creates the foundational tables for the NEXUS autonomous AI employee runtime:
- agents: registry of all AI agents (coding, research, email, etc.)
- agent_tasks: tasks assigned to agents with full lifecycle tracking
- commands: natural language translated to executable commands
- command_steps: individual steps within a command execution
- events: central event bus for all NEXUS system events
- tool_registry: catalog of all tools available to agents
- audit_logs: security audit trail for all actions

## New Tables
1. agents — AI agent registry (name, type, system_prompt, skills, tools, permissions, status)
2. agent_tasks — tasks assigned to agents (status: queued/running/completed/failed/cancelled)
3. commands — parsed commands from natural language (intent, payload, approval state)
4. command_steps — individual execution steps within a command
5. events — central event bus (event_type, source, payload, agent_id)
6. tool_registry — tool catalog (name, permissions, risk_level, requires_approval)
7. audit_logs — security audit trail

## Security
- RLS enabled on all tables
- anon + authenticated access (single-tenant, no auth screen)
*/

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================
-- AGENTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('coding','research','email','automation','data','web','game','custom')),
  system_prompt text NOT NULL DEFAULT '',
  skills jsonb NOT NULL DEFAULT '[]'::jsonb,
  tools jsonb NOT NULL DEFAULT '[]'::jsonb,
  permissions jsonb NOT NULL DEFAULT '[]'::jsonb,
  memory_scope text NOT NULL DEFAULT 'isolated',
  workspace_path text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'idle' CHECK (status IN ('idle','active','processing','error','stopped')),
  current_task_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE agents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_agents" ON agents;
CREATE POLICY "select_agents" ON agents FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "insert_agents" ON agents;
CREATE POLICY "insert_agents" ON agents FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_agents" ON agents;
CREATE POLICY "update_agents" ON agents FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_agents" ON agents;
CREATE POLICY "delete_agents" ON agents FOR DELETE
  TO anon, authenticated USING (true);

-- ============================================================
-- AGENT TASKS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS agent_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid REFERENCES agents(id) ON DELETE SET NULL,
  command_id uuid,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','completed','failed','cancelled')),
  priority int NOT NULL DEFAULT 5,
  result jsonb,
  error text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE agent_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_agent_tasks" ON agent_tasks;
CREATE POLICY "select_agent_tasks" ON agent_tasks FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "insert_agent_tasks" ON agent_tasks;
CREATE POLICY "insert_agent_tasks" ON agent_tasks FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_agent_tasks" ON agent_tasks;
CREATE POLICY "update_agent_tasks" ON agent_tasks FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_agent_tasks" ON agent_tasks;
CREATE POLICY "delete_agent_tasks" ON agent_tasks FOR DELETE
  TO anon, authenticated USING (true);

-- ============================================================
-- COMMANDS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS commands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_input text NOT NULL,
  intent text,
  command_type text NOT NULL DEFAULT 'unknown',
  command_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','validated','executing','completed','failed','cancelled')),
  approval_required boolean NOT NULL DEFAULT false,
  approved boolean NOT NULL DEFAULT false,
  risk_level text NOT NULL DEFAULT 'low' CHECK (risk_level IN ('low','medium','high')),
  required_tools jsonb NOT NULL DEFAULT '[]'::jsonb,
  agent_id uuid REFERENCES agents(id) ON DELETE SET NULL,
  task_id uuid REFERENCES agent_tasks(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE commands ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_commands" ON commands;
CREATE POLICY "select_commands" ON commands FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "insert_commands" ON commands;
CREATE POLICY "insert_commands" ON commands FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_commands" ON commands;
CREATE POLICY "update_commands" ON commands FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_commands" ON commands;
CREATE POLICY "delete_commands" ON commands FOR DELETE
  TO anon, authenticated USING (true);

-- ============================================================
-- COMMAND STEPS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS command_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  command_id uuid REFERENCES commands(id) ON DELETE CASCADE,
  step_number int NOT NULL,
  action text NOT NULL,
  target text,
  params jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','completed','failed','skipped')),
  output text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE command_steps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_command_steps" ON command_steps;
CREATE POLICY "select_command_steps" ON command_steps FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "insert_command_steps" ON command_steps;
CREATE POLICY "insert_command_steps" ON command_steps FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_command_steps" ON command_steps;
CREATE POLICY "update_command_steps" ON command_steps FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_command_steps" ON command_steps;
CREATE POLICY "delete_command_steps" ON command_steps FOR DELETE
  TO anon, authenticated USING (true);

-- ============================================================
-- EVENTS TABLE (Central Event Bus)
-- ============================================================
CREATE TABLE IF NOT EXISTS events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  source text NOT NULL DEFAULT 'system',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  agent_id uuid REFERENCES agents(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_events" ON events;
CREATE POLICY "select_events" ON events FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "insert_events" ON events;
CREATE POLICY "insert_events" ON events FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "delete_events" ON events;
CREATE POLICY "delete_events" ON events FOR DELETE
  TO anon, authenticated USING (true);

-- ============================================================
-- TOOL REGISTRY TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS tool_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text NOT NULL DEFAULT '',
  permissions jsonb NOT NULL DEFAULT '[]'::jsonb,
  risk_level text NOT NULL DEFAULT 'low' CHECK (risk_level IN ('low','medium','high')),
  requires_approval boolean NOT NULL DEFAULT false,
  enabled boolean NOT NULL DEFAULT true,
  category text NOT NULL DEFAULT 'general',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE tool_registry ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_tool_registry" ON tool_registry;
CREATE POLICY "select_tool_registry" ON tool_registry FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "insert_tool_registry" ON tool_registry;
CREATE POLICY "insert_tool_registry" ON tool_registry FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_tool_registry" ON tool_registry;
CREATE POLICY "update_tool_registry" ON tool_registry FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- AUDIT LOGS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL,
  actor text NOT NULL DEFAULT 'system',
  target text,
  permissions_used jsonb NOT NULL DEFAULT '[]'::jsonb,
  approved boolean NOT NULL DEFAULT false,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_audit_logs" ON audit_logs;
CREATE POLICY "select_audit_logs" ON audit_logs FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "insert_audit_logs" ON audit_logs;
CREATE POLICY "insert_audit_logs" ON audit_logs FOR INSERT
  TO anon, authenticated WITH CHECK (true);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_agents_status ON agents (status);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_status ON agent_tasks (status);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_agent ON agent_tasks (agent_id);
CREATE INDEX IF NOT EXISTS idx_commands_status ON commands (status);
CREATE INDEX IF NOT EXISTS idx_command_steps_command ON command_steps (command_id);
CREATE INDEX IF NOT EXISTS idx_events_type ON events (event_type);
CREATE INDEX IF NOT EXISTS idx_events_created ON events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs (created_at DESC);

-- ============================================================
-- UPDATED_AT TRIGGER for agents
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_agents_updated_at ON agents;
CREATE TRIGGER trg_agents_updated_at
  BEFORE UPDATE ON agents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- SEED TOOL REGISTRY
-- ============================================================
INSERT INTO tool_registry (name, description, permissions, risk_level, requires_approval, category) VALUES
  ('filesystem.read', 'Read files and directories', '["filesystem.read"]', 'low', false, 'filesystem'),
  ('filesystem.write', 'Write and create files', '["filesystem.write"]', 'medium', false, 'filesystem'),
  ('filesystem.delete', 'Delete files and directories', '["filesystem.delete"]', 'high', true, 'filesystem'),
  ('terminal.execute', 'Execute terminal commands', '["terminal.execute"]', 'high', true, 'terminal'),
  ('terminal.stream', 'Stream terminal output', '["terminal.stream"]', 'medium', false, 'terminal'),
  ('github.read', 'Read GitHub repositories and data', '["github.read"]', 'low', false, 'github'),
  ('github.write', 'Write to GitHub repositories', '["github.write"]', 'high', true, 'github'),
  ('email.read', 'Read emails', '["email.read"]', 'low', false, 'email'),
  ('email.send', 'Send emails', '["email.send"]', 'high', true, 'email'),
  ('calendar.read', 'Read calendar events', '["calendar.read"]', 'low', false, 'calendar'),
  ('calendar.write', 'Create/modify calendar events', '["calendar.write"]', 'medium', true, 'calendar'),
  ('browser.navigate', 'Navigate to URLs in browser', '["browser.navigate"]', 'low', false, 'browser'),
  ('browser.automate', 'Automate browser interactions', '["browser.automate"]', 'medium', false, 'browser'),
  ('vscode.open', 'Open files in VS Code', '["vscode.open"]', 'low', false, 'vscode'),
  ('n8n.trigger', 'Trigger n8n workflows', '["n8n.trigger"]', 'medium', true, 'n8n'),
  ('applications.build', 'Build applications', '["applications.build"]', 'medium', false, 'applications'),
  ('applications.launch', 'Launch applications', '["applications.launch"]', 'medium', false, 'applications'),
  ('applications.stop', 'Stop running applications', '["applications.stop"]', 'medium', false, 'applications'),
  ('docker.run', 'Run Docker containers', '["docker.run"]', 'high', true, 'docker')
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- SEED DEFAULT AGENTS
-- ============================================================
INSERT INTO agents (name, type, system_prompt, skills, tools, permissions, status) VALUES
  ('Nexus Core', 'custom', 'You are Nexus Core, the central AI employee orchestrator. You understand user requests, create executable commands, and coordinate other agents.', '["orchestration","planning","command_generation","coordination"]', '["filesystem.read","terminal.stream"]', '["filesystem.read","terminal.stream"]', 'idle'),
  ('Coding Agent', 'coding', 'You are a Coding Agent. You create projects, write code, install dependencies, run tests, and launch applications.', '["coding","debugging","testing","project_creation"]', '["filesystem.read","filesystem.write","terminal.execute","github.read","applications.build","applications.launch"]', '["filesystem.read","filesystem.write","terminal.execute","github.read","applications.build","applications.launch"]', 'idle'),
  ('Research Agent', 'research', 'You are a Research Agent. You search the web, analyze data, and compile reports.', '["research","analysis","web_search","data_synthesis"]', '["browser.navigate","browser.automate"]', '["browser.navigate","browser.automate"]', 'idle')
ON CONFLICT DO NOTHING;
