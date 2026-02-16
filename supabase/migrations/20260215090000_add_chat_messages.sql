-- Migration: Add chat messages for AI chatbot
-- Description: Stores chat messages and history for the AI chatbot feature
-- Author: AI Chatbot Team
-- Date: 2026-02-15

-- ==========================================================================
-- TABLE: chat_messages
-- ==========================================================================
-- Stores all chat messages between users and the AI chatbot, including
-- proposed actions and confirmations

CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id UUID NOT NULL, -- Groups messages into chat sessions
  role VARCHAR(50) NOT NULL, -- 'user', 'assistant'
  content TEXT NOT NULL, -- The chat message content
  action_proposed JSONB, -- Proposed action by AI: {tool, params, description}
  action_confirmed BOOLEAN DEFAULT FALSE, -- Whether user confirmed the action
  action_result JSONB, -- Result of executed action
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================================================
-- ROW LEVEL SECURITY: chat_messages
-- ==========================================================================
-- Enable RLS to ensure users can only access their own chat history

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own chat messages"
ON chat_messages FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own chat messages"
ON chat_messages FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own chat messages"
ON chat_messages FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own chat messages"
ON chat_messages FOR DELETE
USING (auth.uid() = user_id);

-- ==========================================================================
-- INDEXES
-- ==========================================================================

-- Index for fetching chat history by user and session
CREATE INDEX idx_chat_messages_user_session ON chat_messages(user_id, session_id, created_at DESC);

-- Index for fetching recent messages by user
CREATE INDEX idx_chat_messages_user_created ON chat_messages(user_id, created_at DESC);

-- Index for session queries
CREATE INDEX idx_chat_messages_session ON chat_messages(session_id, created_at DESC);
