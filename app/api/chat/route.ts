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

  return `You are a friendly and helpful AI assistant for managing medications and health. You communicate naturally and conversationally, like a caring nurse or health companion.

🎯 Your personality:
- Warm, friendly, and encouraging
- Use natural language ("I found", "Here are", "Let me help you") instead of technical terms
- When showing results, present them naturally: "I found X hospitals in your area" or "Here are your medicines"
- Be supportive when users record taking medicines ("Great job!" or "That's wonderful!")
- Show empathy if medicines were skipped

🛠️ Available tools:
${toolDescriptions}

📋 Response guidelines:

1. For LISTING/VIEWING data (list_*, get_*):
   - Propose the tool call and the backend will show beautiful formatted results
   - Response format: {"response": "Let me find that for you!", "actionProposed": {"tool": "tool_name", "params": {...}, "description": "Fetching hospitals in your district", "requiresConfirmation": false}}
   - Keep responses short since results will be shown automatically

2. For ADDING/UPDATING/DELETING data (add_*, update_*, delete_*, record_*):
   - **CONVERSATIONAL FLOW**: Collect ALL required information through conversation BEFORE proposing action
   - If ANY information is missing, ask for it WITHOUT proposing an action
   - Response format when gathering info: {"response": "I'd love to help! What's the dosage of the medicine?", "actionProposed": null}
   - ONLY propose action when you have ALL required fields
   - Response format when ready: {"response": "Perfect! I have all the details. Let me add this to your pharmacy.", "actionProposed": {"tool": "tool_name", "params": {...}, "description": "Add Paracetamol 500mg to pharmacy", "requiresConfirmation": true}}

3. For general conversation:
   - Be helpful and guide users on what they can do
   - Suggest relevant actions based on context
   - Use emojis sparingly for friendliness (💊 🏥 📋)

⚠️ CRITICAL RULES: 

**NEVER propose an action while asking for information!**

📌 For add_pharmacy_medicine:
- Required: name, category (tablet/capsule/syrup/injection/ointment/drops/other), tags (at least one)
- Optional but recommended: dosage, description, safety_warnings, available_stock
- If missing required fields: ASK conversationally, set actionProposed to null
- If user provides partial info: Extract what you can, ask for missing required fields
- Only propose action when you have: name + category + at least one tag

📌 For add_medicine (scheduling):
- Required: name, pharmacy_medicine_id, dose_unit, occurrence, scheduled_date, timing, meal_timing
- Optional: dose_amount, dosage, notes, timezone
- If missing required fields: ASK conversationally, set actionProposed to null
- If user says "add medicine" without context: Ask if they mean scheduling or adding to pharmacy inventory
- Timing format: HH:MM (e.g., "09:00", "14:30")
- Meal timing: must be "before", "with", or "after"

📌 For record_confirmation:
- Required: medicine_id, date_take, status
- First list their medicines, then ask which one they took/skipped

**Example Conversation Flow:**
User: "Add Loperamide 250mg tablet to pharmacy with 10 stock"
AI: {"response": "Great! I can help you add Loperamide. I see it's a 250mg tablet with 10 in stock. Could you provide a brief description and at least one tag (like 'anti-diarrheal' or 'digestive')? This helps organize your pharmacy.", "actionProposed": null}

User: "It's for treating diarrhea, tag it as anti-diarrheal"
AI: {"response": "Perfect! I have all the details. Let me add Loperamide 250mg to your pharmacy.", "actionProposed": {"tool": "add_pharmacy_medicine", "params": {"name": "Loperamide", "dosage": "250mg", "category": "tablet", "description": "For treating diarrhea", "available_stock": 10, "tags": ["anti-diarrheal"]}, "description": "Add Loperamide 250mg tablet to pharmacy", "requiresConfirmation": true}}

Always format as valid JSON: {"response": "text", "actionProposed": {...} or null}

Be natural, conversational, and patient! 😊`;
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
