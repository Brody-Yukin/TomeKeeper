import { Router, type IRouter } from "express";
import express from "express";
import {
  IdentifyBookCoverBody,
  IdentifyBookCoverResponse,
} from "@workspace/api-zod";
import { openai } from "@workspace/integrations-openai-ai-server";

const booksRouter: IRouter = Router();

const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB

// Base64 inflates ~33%; allow headroom for an 8 MB decoded image.
const jsonParser = express.json({ limit: "12mb" });

// Simple in-memory per-IP rate limiter to protect the costly AI endpoint.
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 10;
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const bucket = rateBuckets.get(ip);
  if (!bucket || now > bucket.resetAt) {
    rateBuckets.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    // Opportunistic cleanup of expired buckets.
    if (rateBuckets.size > 1000) {
      for (const [key, b] of rateBuckets) {
        if (now > b.resetAt) rateBuckets.delete(key);
      }
    }
    return false;
  }
  bucket.count += 1;
  return bucket.count > RATE_LIMIT_MAX;
}

const SYSTEM_PROMPT = `You identify books from cover photos. Examine the image and extract:
- title: the book's title as printed on the cover ("" if unreadable)
- authors: array of author names visible on the cover (empty array if none readable)
- publisher: publisher name if visible ("" if not)
- editionText: any edition text visible, e.g. "Second Edition", "Anniversary Edition" ("" if none)
- possibleIsbn: an ISBN-10 or ISBN-13 if visible anywhere in the image, digits only ("" if none)
- confidence: number 0-1 for how confident you are this is a book cover and the extraction is correct

Respond ONLY with a JSON object with exactly these keys.`;

booksRouter.post("/books/identify-cover", jsonParser, async (req, res) => {
  const ip = req.ip ?? "unknown";
  if (isRateLimited(ip)) {
    res.status(429).json({ message: "Too many requests, try again shortly" });
    return;
  }

  const parsed = IdentifyBookCoverBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid request body" });
    return;
  }

  const { imageBase64, mimeType } = parsed.data;

  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    res.status(400).json({ message: "Unsupported image type" });
    return;
  }

  let imageBytes: number;
  try {
    imageBytes = Buffer.from(imageBase64, "base64").byteLength;
  } catch {
    res.status(400).json({ message: "Invalid base64 image data" });
    return;
  }
  if (imageBytes === 0) {
    res.status(400).json({ message: "Empty image" });
    return;
  }
  if (imageBytes > MAX_IMAGE_BYTES) {
    res.status(400).json({ message: "Image exceeds the 8 MB limit" });
    return;
  }

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-5.6-terra",
      max_completion_tokens: 8192,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "text", text: "Identify this book cover." },
            {
              type: "image_url",
              image_url: { url: `data:${mimeType};base64,${imageBase64}` },
            },
          ],
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    const json = JSON.parse(raw) as Record<string, unknown>;

    const analysis = IdentifyBookCoverResponse.parse({
      title: typeof json["title"] === "string" ? json["title"] : "",
      authors: Array.isArray(json["authors"])
        ? json["authors"].filter((a): a is string => typeof a === "string")
        : [],
      publisher: typeof json["publisher"] === "string" ? json["publisher"] : "",
      editionText:
        typeof json["editionText"] === "string" ? json["editionText"] : "",
      possibleIsbn:
        typeof json["possibleIsbn"] === "string"
          ? json["possibleIsbn"].replace(/[^0-9Xx]/g, "")
          : "",
      confidence:
        typeof json["confidence"] === "number"
          ? Math.min(1, Math.max(0, json["confidence"]))
          : 0,
    });

    res.json(analysis);
  } catch (err) {
    req.log.error({ err }, "Cover identification failed");
    res.status(502).json({ message: "Cover identification failed" });
  }
});

export default booksRouter;
