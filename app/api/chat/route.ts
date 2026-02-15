// app/api/chat/route.ts
// Chat endpoint that interfaces with AI providers (Gemini/OpenAI)

import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/app/utils/supabase/server";
import { MCP_TOOLS, findTool } from "@/app/lib/mcp-tools";

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
 * Execute a tool and return results
 */
async function executeTool(
  toolName: string,
  params: Record<string, unknown>,
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<Record<string, unknown>> {
  const tool = findTool(toolName);
  if (!tool) {
    throw new Error(`Unknown tool: ${toolName}`);
  }

  try {
    switch (toolName) {
      case "list_medicines": {
        const { data, error } = await supabase
          .from('user_medicines')
          .select('*')
          .order('created_at', { ascending: false });
        if (error) throw error;
        return { medicines: data || [] };
      }

      case "list_pharmacy_medicines": {
        let query = supabase.from('pharmacy_medicines').select('*');
        if (params.limit) query = query.limit(params.limit as number);
        if (params.offset) query = query.range((params.offset as number), (params.offset as number) + ((params.limit as number) || 50) - 1);
        const { data, error } = await query.order('created_at', { ascending: false });
        if (error) throw error;
        return { medicines: data || [] };
      }

      case "list_confirmations": {
        const daysBack = (params.days as number) || 7;
        const fromDate = new Date();
        fromDate.setDate(fromDate.getDate() - daysBack);

        const { data, error } = await supabase
          .from('confirmations')
          .select('*')
          .gte('date_take', fromDate.toISOString().split('T')[0])
          .order('date_take', { ascending: false });
        if (error) throw error;
        return { confirmations: data || [] };
      }

      case "list_hospitals": {
        let query = supabase.from('hospitals').select('*');
        if (params.district) query = query.ilike('district', `%${params.district}%`);
        if (params.speciality) query = query.ilike('speciality', `%${params.speciality}%`);
        if (params.limit) query = query.limit(params.limit as number);
        if (params.offset) query = query.range((params.offset as number), (params.offset as number) + ((params.limit as number) || 50) - 1);
        const { data, error } = await query.order('name', { ascending: true });
        if (error) throw error;
        return { hospitals: data || [] };
      }

      case "get_profile": {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) throw new Error('Not authenticated');

        const { data, error } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        if (error && error.code !== 'PGRST116') throw error;
        return data || { id: user.id, email: user.email };
      }

      default:
        throw new Error(`Tool execution not implemented: ${toolName}`);
    }
  } catch (error) {
    console.error(`Error executing tool ${toolName}:`, error);
    throw error;
  }
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

IMPORTANT: When responding to user requests:
1. For READ-ONLY operations (list_*, get_*): 
   - Respond with: {"response": "I will fetch this data for you", "actionProposed": {"tool": "tool_name", "params": {...}, "description": "...", "requiresConfirmation": false}}
   - Return the tool call ONLY (no additional explanation)
   - The backend will execute the tool and format results

2. For WRITE operations (add_*, update_*, delete_*, record_*):
   - Propose action: {"response": "I can do this for you. Please confirm.", "actionProposed": {"tool": "tool_name", "params": {...}, "description": "...", "requiresConfirmation": true}}
   - Wait for user confirmation before execution

Always format responses as valid JSON with keys: "response" and "actionProposed" (or null).`;
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

    // If the AI proposed a read-only action, check parameters and execute
    if (result.actionProposed && !result.actionProposed.requiresConfirmation) {
      const tool = findTool(result.actionProposed.tool);
      const params = result.actionProposed.params;

      // Check for missing required parameters that can be asked from user
      let missingParam = '';
      if (result.actionProposed.tool === 'list_hospitals' && !params.district && !params.speciality) {
        missingParam = 'district';
      }

      if (missingParam) {
        // Ask user for the missing parameter
        return NextResponse.json({
          response: `I'd like to help you find hospitals, but I need to know which district you're interested in. Could you please tell me the district name?`,
          actionProposed: null,
          sessionId,
          askingForParameter: missingParam
        });
      }

      try {
        const toolResult = await executeTool(result.actionProposed.tool, params, supabase);
        
        // Build results response with structured data
        let resultData: Record<string, unknown> = {};
        let itemsToDisplay: Array<Record<string, unknown>> = [];
        let total = 0;
        let viewAllUrl = '';
        const ITEMS_LIMIT = 15;

        if (result.actionProposed.tool === 'list_hospitals') {
          const hospitals = (toolResult as Record<string, unknown>).hospitals as Array<Record<string, unknown>> || [];
          total = hospitals.length;
          itemsToDisplay = hospitals.slice(0, ITEMS_LIMIT);
          
          const urlParams = new URLSearchParams();
          if (params.district) urlParams.append('district', String(params.district));
          if (params.speciality) urlParams.append('speciality', String(params.speciality));
          viewAllUrl = `/hospitals${urlParams.toString() ? `?${urlParams.toString()}` : ''}`;
          
          resultData = {
            type: 'hospitals',
            items: itemsToDisplay,
            total,
            viewAllUrl
          };
        } else if (result.actionProposed.tool === 'list_medicines') {
          const medicines = (toolResult as Record<string, unknown>).medicines as Array<Record<string, unknown>> || [];
          total = medicines.length;
          itemsToDisplay = medicines.slice(0, ITEMS_LIMIT);
          
          resultData = {
            type: 'medicines',
            items: itemsToDisplay,
            total
          };
        } else if (result.actionProposed.tool === 'list_pharmacy_medicines') {
          const medicines = (toolResult as Record<string, unknown>).medicines as Array<Record<string, unknown>> || [];
          total = medicines.length;
          itemsToDisplay = medicines.slice(0, ITEMS_LIMIT);
          
          resultData = {
            type: 'pharmacy_medicines',
            items: itemsToDisplay,
            total,
            viewAllUrl: '/digital-pharmacy'
          };
        } else if (result.actionProposed.tool === 'list_confirmations') {
          const confirmations = (toolResult as Record<string, unknown>).confirmations as Array<Record<string, unknown>> || [];
          total = confirmations.length;
          itemsToDisplay = confirmations.slice(0, ITEMS_LIMIT);
          
          resultData = {
            type: 'confirmations',
            items: itemsToDisplay,
            total
          };
        } else {
          resultData = toolResult;
        }

        const response = `Found ${total} results${total > ITEMS_LIMIT ? ` (showing first ${ITEMS_LIMIT})` : ''}`;

        return NextResponse.json({
          response,
          actionProposed: null,
          sessionId,
          results: resultData,
          toolExecuted: true
        });
      } catch (error) {
        console.error('Error executing read-only tool:', error);
        return NextResponse.json({
          response: `Sorry, I encountered an error fetching that data: ${error instanceof Error ? error.message : 'Unknown error'}`,
          actionProposed: null,
          sessionId,
          toolExecuted: false
        });
      }
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
