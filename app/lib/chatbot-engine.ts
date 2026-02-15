// app/lib/chatbot-engine.ts
// Core chatbot engine with Supabase persistence and AI chat logic

import { createClient as createSupabaseClient } from "@/app/utils/supabase/client";
import { MCP_TOOLS, findTool } from "./mcp-tools";
import { v4 as uuidv4 } from "uuid";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  actionProposed?: {
    tool: string;
    params: Record<string, unknown>;
    description: string;
    requiresConfirmation: boolean;
  };
  actionConfirmed?: boolean;
  actionResult?: Record<string, unknown>;
  createdAt: string;
}

export interface ChatSession {
  id: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
  preview?: string;
  messageCount?: number;
}

/**
 * Execute a chat query through the AI and get back a proposed action or response
 */
export async function executeChatQuery(
  userMessage: string,
  sessionId: string,
  chatHistory: ChatMessage[]
): Promise<{
  response: string;
  actionProposed?: {
    tool: string;
    params: Record<string, unknown>;
    description: string;
    requiresConfirmation: boolean;
  };
  results?: Record<string, unknown>;
}> {
  try {
    // Build context from tool definitions
    const toolsContext = MCP_TOOLS.map(tool => ({
      name: tool.name,
      description: tool.description,
      params: tool.inputSchema.properties,
      required: tool.inputSchema.required
    }));

    // Build conversation history for context
    const conversationHistory = chatHistory.map(msg => ({
      role: msg.role,
      content: msg.content
    }));

    // Call the chat API
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userMessage,
        conversationHistory,
        tools: toolsContext,
        sessionId
      })
    });

    if (!response.ok) {
      throw new Error(`Chat API error: ${response.statusText}`);
    }

    const data = await response.json();

    return {
      response: data.response,
      actionProposed: data.actionProposed,
      results: data.results
    };
  } catch (error) {
    console.error("Error executing chat query:", error);
    throw error;
  }
}

/**
 * Save a message to the database
 */
export async function saveChatMessage(
  userId: string,
  sessionId: string,
  role: "user" | "assistant",
  content: string,
  actionProposed?: Record<string, unknown>
): Promise<ChatMessage> {
  const supabase = createSupabaseClient();

  const messageId = uuidv4();

  const { data, error } = await supabase
    .from("chat_messages")
    .insert({
      id: messageId,
      user_id: userId,
      session_id: sessionId,
      role,
      content,
      action_proposed: actionProposed || null,
      created_at: new Date().toISOString()
    })
    .select()
    .single();

  if (error) {
    console.error("Error saving chat message:", error);
    throw error;
  }

  return {
    id: data.id,
    role: data.role,
    content: data.content,
    actionProposed: data.action_proposed,
    actionConfirmed: data.action_confirmed,
    actionResult: data.action_result,
    createdAt: data.created_at
  };
}

/**
 * Load chat history for a session
 */
export async function loadChatHistory(
  userId: string,
  sessionId: string
): Promise<ChatMessage[]> {
  const supabase = createSupabaseClient();

  const { data, error } = await supabase
    .from("chat_messages")
    .select("*")
    .eq("user_id", userId)
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error loading chat history:", error);
    return [];
  }

  return (data || []).map(msg => ({
    id: msg.id,
    role: msg.role,
    content: msg.content,
    actionProposed: msg.action_proposed,
    actionConfirmed: msg.action_confirmed,
    actionResult: msg.action_result,
    createdAt: msg.created_at
  }));
}

/**
 * Update message with action confirmation and result
 */
export async function updateMessageWithActionResult(
  messageId: string,
  actionConfirmed: boolean,
  actionResult?: Record<string, unknown>
): Promise<void> {
  const supabase = createSupabaseClient();

  const { error } = await supabase
    .from("chat_messages")
    .update({
      action_confirmed: actionConfirmed,
      action_result: actionResult,
      updated_at: new Date().toISOString()
    })
    .eq("id", messageId);

  if (error) {
    console.error("Error updating message:", error);
    throw error;
  }
}

/**
 * Execute a tool based on its name and parameters
 * This is called after user confirms an action
 */
export async function executeTool(
  toolName: string,
  params: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const tool = findTool(toolName);
  if (!tool) {
    throw new Error(`Unknown tool: ${toolName}`);
  }

  // Route to appropriate API endpoint
  try {
    switch (toolName) {
      case "list_medicines":
        return await callApi("GET", "/api/medicines");
      
      case "add_medicine":
        return await callApi("POST", "/api/medicines", params);
      
      case "update_medicine":
        return await callApi("PUT", `/api/medicines/${params.id}`, params);
      
      case "delete_medicine":
        return await callApi("DELETE", `/api/medicines/${params.id}`);
      
      case "list_pharmacy_medicines":
        const queryParams = new URLSearchParams();
        if (params.tags && Array.isArray(params.tags)) queryParams.append("tags", (params.tags as string[]).join(","));
        if (params.limit) queryParams.append("limit", String(params.limit));
        if (params.offset) queryParams.append("offset", String(params.offset));
        return await callApi("GET", `/api/pharmacy-medicines?${queryParams.toString()}`);
      
      case "add_pharmacy_medicine":
        // Ensure required fields have defaults
        const pharmParams = {
          ...params,
          category: params.category || 'other',
          tags: Array.isArray(params.tags) && params.tags.length > 0 
            ? params.tags 
            : ['general'],
          available_stock: params.available_stock ?? 0
        };
        return await callApi("POST", "/api/pharmacy-medicines", pharmParams);
      
      case "update_pharmacy_medicine":
        return await callApi("PUT", `/api/pharmacy-medicines/${params.id}`, params);
      
      case "delete_pharmacy_medicine":
        return await callApi("DELETE", `/api/pharmacy-medicines/${params.id}`);
      
      case "list_confirmations":
        const confirmParams = new URLSearchParams();
        if (params.days) confirmParams.append("days", String(params.days));
        if (params.limit) confirmParams.append("limit", String(params.limit));
        return await callApi("GET", `/api/confirmations?${confirmParams.toString()}`);
      
      case "record_confirmation":
        return await callApi("POST", "/api/confirmations", params);
      
      case "list_hospitals":
        const hospParams = new URLSearchParams();
        if (params.district) hospParams.append("district", String(params.district));
        if (params.speciality) hospParams.append("speciality", String(params.speciality));
        if (params.limit) hospParams.append("limit", String(params.limit));
        if (params.offset) hospParams.append("offset", String(params.offset));
        return await callApi("GET", `/api/hospitals?${hospParams.toString()}`);
      
      case "get_profile":
        return await callApi("GET", "/api/profile");
      
      case "update_profile":
        return await callApi("PUT", "/api/profile", params);
      
      case "identify_medicine":
        return await callApi("POST", "/api/identify", { image: params.image });
      
      default:
        throw new Error(`Tool execution not implemented: ${toolName}`);
    }
  } catch (error) {
    console.error(`Error executing tool ${toolName}:`, error);
    throw error;
  }
}

/**
 * Helper to make API calls
 */
async function callApi(
  method: string,
  endpoint: string,
  body?: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const options: RequestInit = {
    method,
    headers: { "Content-Type": "application/json" }
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(endpoint, options);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(`API error: ${error.error || response.statusText}`);
  }

  // For DELETE requests, there might not be a body
  if (method === "DELETE") {
    return { success: true };
  }

  return await response.json();
}

/**
 * Create a new chat session
 */
export function createNewSession(): string {
  return uuidv4();
}

/**
 * Load all sessions for a user with preview and message count
 */
export async function loadUserSessions(userId: string): Promise<ChatSession[]> {
  const supabase = createSupabaseClient();

  const { data, error } = await supabase
    .from("chat_messages")
    .select("session_id, content, role, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error loading sessions:", error);
    return [];
  }

  // Group by session_id and get preview (first user message)
  const sessionsMap = new Map<string, ChatSession>();

  (data || []).forEach(msg => {
    if (!sessionsMap.has(msg.session_id)) {
      // Get first user message as preview
      const firstUserMsg = (data || []).find(
        m => m.session_id === msg.session_id && m.role === 'user'
      );
      const preview = firstUserMsg?.content.slice(0, 50) || 'New chat';
      
      sessionsMap.set(msg.session_id, {
        id: msg.session_id,
        messages: [],
        createdAt: msg.created_at,
        updatedAt: msg.created_at,
        preview,
        messageCount: 0
      });
    }
    
    // Count messages
    const session = sessionsMap.get(msg.session_id)!;
    session.messageCount = (session.messageCount || 0) + 1;
    
    // Update most recent timestamp
    if (msg.created_at > session.updatedAt) {
      session.updatedAt = msg.created_at;
    }
  });

  return Array.from(sessionsMap.values()).sort((a, b) => 
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}
