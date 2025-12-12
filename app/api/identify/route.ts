// src/app/api/identify/route.ts
import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);

export async function POST(req: Request) {
  try {
    const { image } = await req.json();

    if (!image) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    // The Prompt: We teach the AI to be a pharmacist and return strict JSON
    const prompt = `Identify the medicine in this image. Return a JSON object with the following keys:
- brand_name: The name of the medicine
- purpose: What it treats (1 short sentence)
- active_ingredient: The active ingredient(s)
- warnings: A brief usage warning
- usage_timing: When to take it (e.g., "after meal", "before bed")

Return ONLY a raw JSON object (no markdown formatting). If you cannot identify a medicine, return:
{ "error": "Could not identify medicine" }`;

    const result = await model.generateContent([
      {
        text: prompt
      },
      {
        inlineData: {
          mimeType: "image/jpeg",
          data: image
        }
      }
    ]);
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