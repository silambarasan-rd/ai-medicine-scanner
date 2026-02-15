// app/api/chat/route.ts
// Chat endpoint that interfaces with AI providers (Gemini/OpenAI)

import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/app/utils/supabase/server";

const AI_PROVIDER = process.env.AI_PROVIDER || "gemini";

interface ToolDefinition {
  name: string;
  description: string;
  params: Record<string, unknown>;
  required: string[];
}

interface ChatRequest {
  userMessage: string;
  conversationHistory: Array<{ role: string; content: string }>;
  tools: ToolDefinition[];
  sessionId: string;
}

interface ProposedAction {
  tool: string;
  params: Record<string, unknown>;
  description: string;
  requiresConfirmation: boolean;
}

function getGeminiClient() {
  if (!process.env.GOOGLE_API_KEY) {
    throw new Error("GOOGLE_API_KEY is not configured");
  }
  return new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
}

function getOpenAIClient() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured");
  }
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

/**
 * Build system prompt for the AI
 */
function buildSystemPrompt(tools: ToolDefinition[]): string {
  const toolDescriptions = tools.map(tool => {
    const paramsStr = Object.entries(tool.params)
      .map(([key, value]: [string, unknown]) => `  - ${key}: ${typeof value === 'object' && value !== null && 'description' in value ? (value as Record<string, unknown>).description : ''}`)
      .join('\n');
    
    return `
Tool: ${tool.name}
Description: ${tool.description}
Parameters:
${paramsStr}
Required: ${tool.required.join(', ')}`;
  }).join('\n\n');

  return `You are a helpful medical assistant AI for managing medications and health. You help users:
- Schedule and manage their medicines
- Track medicine inventory (digital pharmacy)
- Record medication confirmations (taken/skipped)
- Find hospitals
- Manage their health profile
- Identify medicines from images

You have access to the following tools to help users with their requests:
${toolDescriptions}

When a user asks you to perform an action:
1. Understand what they want to do
2. Identify which tool(s) would help
3. If action requires confirmation (write operations), propose it with:
   - Which tool to use
   - What parameters to send
   - A brief explanation of what will happen
   - requiresConfirmation: true/false

4. For read-only operations, provide the information directly without proposing actions.

Always be clear, concise, and ask for clarification if needed.
Format your responses in natural language. When proposing an action, clearly state what you're about to do.

IMPORTANT: Return a JSON response in this format (no markdown):
{
  "response": "Your natural language response to the user",
  "actionProposed": null or {
    "tool": "tool_name",
    "params": {...parameter values...},
    "description": "What this action will do",
    "requiresConfirmation": true/false
  }
}`;
}

/**
 * Chat with Gemini
 */
async function chatWithGemini(
  systemPrompt: string,
  conversationHistory: Array<{ role: string; content: string }>,
  userMessage: string
): Promise<{ response: string; actionProposed?: ProposedAction }> {
  const genAI = getGeminiClient();
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  // Build conversation for Gemini
  const messages = [
    { role: "user", parts: [{ text: systemPrompt }] },
    ...conversationHistory.map(msg => ({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }]
    })),
    { role: "user", parts: [{ text: userMessage }] }
  ];

  const response = await model.generateContent({ contents: messages });
  let responseText = response.response.text();

  // Clean markdown code blocks if present
  responseText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();

  try {
    const parsed = JSON.parse(responseText);
    return {
      response: parsed.response || responseText,
      actionProposed: parsed.actionProposed
    };
  } catch {
    // If not valid JSON, return as-is response
    return { response: responseText };
  }
}

/**
 * Chat with OpenAI
 */
async function chatWithOpenAI(
  systemPrompt: string,
  conversationHistory: Array<{ role: string; content: string }>,
  userMessage: string
): Promise<{ response: string; actionProposed?: ProposedAction }> {
  const openAI = getOpenAIClient();

  const messages = [
    { role: "system" as const, content: systemPrompt },
    ...conversationHistory.map(msg => ({
      role: msg.role as "user" | "assistant",
      content: msg.content
    })),
    { role: "user" as const, content: userMessage }
  ];

  const response = await openAI.chat.completions.create({
    model: "gpt-4o-mini",
    messages,
    response_format: { type: "json_object" }
  });

  const content = response.choices[0]?.message.content || '{}';

  try {
    const parsed = JSON.parse(content);
    return {
      response: parsed.response || content,
      actionProposed: parsed.actionProposed
    };
  } catch {
    return { response: content };
  }
}

export async function POST(req: NextRequest) {
  try {
    // Verify authentication
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Parse request
    const {
      userMessage,
      conversationHistory,
      tools,
      sessionId
    }: ChatRequest = await req.json();

    if (!userMessage || !Array.isArray(tools)) {
      return NextResponse.json(
        { error: "Missing required fields: userMessage, tools" },
        { status: 400 }
      );
    }

    const systemPrompt = buildSystemPrompt(tools);

    // Call appropriate AI provider
    let result;
    switch (AI_PROVIDER.toLowerCase()) {
      case "openai":
        result = await chatWithOpenAI(systemPrompt, conversationHistory, userMessage);
        break;
      case "gemini":
      default:
        result = await chatWithGemini(systemPrompt, conversationHistory, userMessage);
        break;
    }

    return NextResponse.json({
      response: result.response,
      actionProposed: result.actionProposed,
      sessionId
    });
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      { error: "Failed to process chat request" },
      { status: 500 }
    );
  }
}
