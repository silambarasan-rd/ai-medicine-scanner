// src/app/api/identify/route.ts
import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);

export async function POST(req: Request) {
  try {
    const { text } = await req.json();

    if (!text) {
      return NextResponse.json({ error: "No text provided" }, { status: 400 });
    }

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    // The Prompt: We teach the AI to be a pharmacist and return strict JSON
    const prompt = `
      I have extracted the following text from a medicine box using OCR. It might be messy or contain typos.
      
      EXTRACTED TEXT:
      "${text}"

      TASK:
      1. Identify the medicine name from the text.
      2. Explain its primary purpose (what it treats).
      3. List the active ingredients if found (or infer them based on the brand name).
      4. Provide a very brief usage warning.

      OUTPUT FORMAT:
      Return ONLY a raw JSON object (no markdown formatting) with these keys:
      {
        "brand_name": "String",
        "purpose": "String (1 short sentence)",
        "active_ingredient": "String",
        "warnings": "String"
      }

      If you strictly cannot identify a medicine in the text, return:
      { "error": "Could not identify medicine" }
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    let jsonString = response.text();

    // Cleanup: Sometimes AI adds markdown like \`\`\`json ... \`\`\`
    jsonString = jsonString.replace(/```json/g, '').replace(/```/g, '').trim();

    const data = JSON.parse(jsonString);

    return NextResponse.json(data);

  } catch (error) {
    console.error("AI Error:", error);
    return NextResponse.json({ error: "Failed to analyze text" }, { status: 500 });
  }
}