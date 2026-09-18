import "server-only";
import { GoogleGenAI } from "@google/genai";
import { CLAIMS_SQL_TEMPLATES } from "@/lib/query/templates";
import {
  buildSelectPrompt,
  normalizeGeminiSelection,
  type TemplateSelection,
} from "@/lib/query/select-template";

export async function selectTemplateWithGemini(
  question: string,
  today: string,
): Promise<TemplateSelection> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY");
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: { timeout: 25_000 },
  });
  const prompt = buildSelectPrompt(question, today, CLAIMS_SQL_TEMPLATES);
  const response = await ai.models.generateContent({
    model: "gemini-flash-latest",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      thinkingConfig: { thinkingBudget: 0 },
    },
  });

  if (!response.text) {
    throw new Error("Empty Gemini response");
  }

  const result = JSON.parse(response.text);
  return normalizeGeminiSelection(result);
}
