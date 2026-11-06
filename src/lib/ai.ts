import "server-only";
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
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) throw new AiRouteError("AI features are not configured. Set OPENROUTER_API_KEY on the server.", 503);
  const model = process.env.OPENROUTER_MODEL?.trim() || "openrouter/auto";

  await connectToDatabase();
  const now = new Date();
  const { day, expiresAt } = usageWindow(now);
  const limit = dailyLimit();
  const used = await reserveUsage(user.id, day, expiresAt, limit);
  if (used === null) {
    throw new AiRouteError("Your daily AI request limit has been reached.", 429);
  }

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "X-Title": "NounStudyHub",
        ...(process.env.OPENROUTER_SITE_URL?.trim()
          ? { "HTTP-Referer": process.env.OPENROUTER_SITE_URL.trim() }
          : {}),
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        max_tokens: maxOutputTokens,
        ...(responseMimeType === "application/json"
          ? { response_format: { type: "json_object" } }
          : {}),
      }),
    });
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new AiRouteError("OpenRouter rejected the API key or model access. Check your server configuration.", 503);
      }
      if (response.status === 402) {
        throw new AiRouteError("OpenRouter requires available account credits to process this request.", 503);
      }
      if (response.status === 429) {
        throw new AiRouteError("OpenRouter is busy or rate-limited right now. Please try again shortly.", 429);
      }
      throw new Error(`OpenRouter request failed with status ${response.status}.`);
    }

    const result = await response.json() as {
      choices?: { message?: { content?: string | { type?: string; text?: string }[] | null } }[];
    };
    const content = result.choices?.[0]?.message?.content;
    const text = (typeof content === "string"
      ? content
      : Array.isArray(content)
        ? content.map((part) => part.text ?? "").join("")
        : "").trim();
    if (!text) throw new Error("Empty model response.");
    return {
      text,
      usage: { used, limit, remaining: Math.max(0, limit - used), day },
    };
  } catch (error) {
    if (error instanceof AiRouteError) throw error;
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
