import "server-only";
import { GoogleGenAI } from "@google/genai";
import { connectToDatabase } from "@/db";
import { AiUsage } from "@/db/models";
import { requireUser } from "@/lib/auth";

const DEFAULT_DAILY_LIMIT = 100;
const USAGE_RETENTION_DAYS = 90;

type AiFeature = "explain" | "chat" | "performance" | "practice";

type GenerateOptions = {
  feature: AiFeature;
  prompt: string;
  responseMimeType?: "text/plain" | "application/json";
  maxOutputTokens?: number;
};

export class AiRouteError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = "AiRouteError";
  }
}

function dailyLimit() {
  const configured = Number(process.env.AI_DAILY_LIMIT ?? DEFAULT_DAILY_LIMIT);
  return Number.isInteger(configured) && configured >= 0 ? configured : DEFAULT_DAILY_LIMIT;
}

function usageWindow(now: Date) {
  const day = now.toISOString().slice(0, 10);
  const expiresAt = new Date(now);
  expiresAt.setUTCDate(expiresAt.getUTCDate() + USAGE_RETENTION_DAYS);
  return { day, expiresAt };
}

async function reserveUsage(userId: string, day: string, expiresAt: Date, limit: number) {
  try {
    await AiUsage.findOneAndUpdate(
      { userId, day },
      { $setOnInsert: { userId, day, count: 0, expiresAt } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  } catch (error) {
    if ((error as { code?: number }).code !== 11000) throw error;
  }

  const updated = await AiUsage.findOneAndUpdate(
    { userId, day, count: { $lt: limit } },
    { $inc: { count: 1 } },
    { new: true },
  ).lean();

  return updated?.count ?? null;
}

export async function generateAiResponse({ feature, prompt, responseMimeType = "text/plain", maxOutputTokens = 1024 }: GenerateOptions) {
  const user = await requireUser();
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new AiRouteError("AI features are not configured.", 503);

  await connectToDatabase();
  const now = new Date();
  const { day, expiresAt } = usageWindow(now);
  const limit = dailyLimit();
  const used = await reserveUsage(user.id, day, expiresAt, limit);
  if (used === null) {
    throw new AiRouteError("Your daily AI request limit has been reached.", 429);
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: { responseMimeType, maxOutputTokens },
    });
    const text = result.text?.trim();
    if (!text) throw new Error("Empty model response.");
    return {
      text,
      usage: { used, limit, remaining: Math.max(0, limit - used), day },
    };
  } catch (error) {
    if (error instanceof AiRouteError) throw error;
    const providerError = error as { status?: number; code?: number | string };
    const providerMessage = error instanceof Error ? error.message : "";
    if (providerError.status === 429 || Number(providerError.code) === 429 || /RESOURCE_EXHAUSTED|\b429\b/i.test(providerMessage)) {
      throw new AiRouteError("Gemini is busy right now. Please try again shortly.", 429);
    }
    console.error(`[ai:${feature}] Provider request failed (${error instanceof Error ? error.name : "unknown error"}).`);
    throw new AiRouteError("The AI service could not complete this request.", 502);
  }
}

export function aiErrorResponse(error: unknown) {
  if (error instanceof AiRouteError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof Error && error.message === "UNAUTHORIZED") {
    return Response.json({ error: "Please log in to use AI features." }, { status: 401 });
  }
  console.error(`[ai] Request failed (${error instanceof Error ? error.name : "unknown error"}).`);
  return Response.json({ error: "Could not process the AI request." }, { status: 500 });
}

export function aiText(value: unknown, maxLength: number) {
  return String(value ?? "").trim().slice(0, maxLength);
}
