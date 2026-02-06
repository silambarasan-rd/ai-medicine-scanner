// src/app/api/identify/route.ts
import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";
import { NextResponse } from "next/server";

const AI_PROVIDER = process.env.AI_PROVIDER || "gemini";

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

async function identifyWithGemini(image: string) {
  const genAI = getGeminiClient();
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  const prompt = `Identify the medicine in this image. Return a JSON object with the following keys:
  - brand_name: The name of the medicine
  - dosage: The strength or dosage (e.g., "500 mg", "10 ml")
  - purpose: What it treats (1 short sentence)
  - active_ingredient: The active ingredient(s)
  - warnings: A brief usage warning
  - usage_timing: When to take it (e.g., "after meal", "before bed")
  - safety_flags (object with booleans: drive, alcohol)

Return ONLY a raw JSON object (no markdown formatting). If you cannot identify a medicine, return:
{ "error": "Could not identify medicine" }`;

  const result = await model.generateContent([
    { text: prompt },
    { inlineData: { mimeType: "image/jpeg", data: image } }
  ]);

  const response = await result.response;
  let jsonString = response.text();

  jsonString = jsonString.replace(/```json/g, '').replace(/```/g, '').trim();

  const data = JSON.parse(jsonString);
  return data;
}

async function identifyWithOpenAI(image: string) {
  const openAI = getOpenAIClient();

  const systemMessage = `You are an expert pharmacist AI. Identify the medicine in the image. Return a valid JSON object with these exact keys:
  - brand_name (string) - The name of the medicine
  - dosage (string) - The strength or dosage (e.g., "500 mg", "10 ml")
  - purpose (string array) - What it treats (1 elaborate short sentence)
  - active_ingredient (string array) - The active ingredient(s)
  - indications (string array, for warnings) - A brief indication or usage warning(s)
  - usage_timing (string) - When to take it (e.g., "after meal", "before bed")
  - safety_flags (object with booleans: drive, alcohol)

  Return ONLY a raw JSON object (no markdown formatting). If you cannot identify a medicine, return: 
  { error: 'Could not identify medicine' }.`;
  
  const response = await openAI.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemMessage },
      {
        role: "user",
        content: [
          { type: "text", text: "Identify the medicine in this image based on the system instructions." },
          { type: "image_url", image_url: { url: image.startsWith('data:image/jpeg;base64,') ? image : `data:image/jpeg;base64,${image}` } }
        ]
      }
    ],
    response_format: { type: "json_object" }
  });

  const jsonString = response.choices[0]?.message.content || '{}';  
  return JSON.parse(jsonString);
}

export async function POST(req: Request) {
  try {
    const { image } = await req.json();
    if (!image) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }

    let data;
    switch (AI_PROVIDER.toLowerCase()) {
      case "openai":
        data = await identifyWithOpenAI(image);
        break;
      case "gemini":
      default:
        data = await identifyWithGemini(image);
        break;
    }

    console.log("Identification Result:", data);

    return NextResponse.json(data);
  } catch (error) {
    console.error("AI Error:", error);
    return NextResponse.json({ error: "Failed to analyze text" }, { status: 500 });
  }
}