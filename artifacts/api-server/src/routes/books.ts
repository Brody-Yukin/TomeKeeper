import { Router, type IRouter } from "express";
import {
  IdentifyBookCoverBody,
  IdentifyBookCoverResponse,
  GetBookByIsbnResponse,
} from "@workspace/api-zod";
import { openai } from "@workspace/integrations-openai-ai-server";

const booksRouter: IRouter = Router();

const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB

// Note: the JSON body parser for this route (12 MB limit) is configured
// path-specifically in app.ts, before the global 100kb parser.

// Matches standard base64 (with optional padding), length divisible by 4.
const BASE64_RE = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

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

booksRouter.post("/books/identify-cover", async (req, res) => {
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

  if (imageBase64.length % 4 !== 0 || !BASE64_RE.test(imageBase64)) {
    res.status(400).json({ message: "Invalid base64 image data" });
    return;
  }

  const imageBytes = Buffer.from(imageBase64, "base64").byteLength;
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

/**
 * Normalize an ISBN (strip hyphens/spaces, uppercase X) and validate its
 * checksum. Returns the normalized ISBN, or null if invalid.
 */
function normalizeIsbn(raw: string): string | null {
  const clean = raw.replace(/[\s-]/g, "").toUpperCase();
  if (/^\d{9}[\dX]$/.test(clean)) {
    // ISBN-10 checksum
    let sum = 0;
    for (let i = 0; i < 10; i++) {
      const c = clean[i];
      const value = c === "X" ? 10 : Number(c);
      sum += value * (10 - i);
    }
    return sum % 11 === 0 ? clean : null;
  }
  if (/^\d{13}$/.test(clean)) {
    // ISBN-13 checksum
    let sum = 0;
    for (let i = 0; i < 13; i++) {
      sum += Number(clean[i]) * (i % 2 === 0 ? 1 : 3);
    }
    return sum % 10 === 0 ? clean : null;
  }
  return null;
}

function volumeInfoToBook(isbn: string, volume: any) {
  const info = volume?.volumeInfo ?? {};
  const identifiers: { type: string; identifier: string }[] =
    info.industryIdentifiers ?? [];
  const isbn13 =
    identifiers.find((i) => i.type === "ISBN_13")?.identifier ?? "";
  const isbn10 =
    identifiers.find((i) => i.type === "ISBN_10")?.identifier ?? "";
  const thumbnail: string =
    info.imageLinks?.extraLarge ||
    info.imageLinks?.large ||
    info.imageLinks?.medium ||
    info.imageLinks?.thumbnail ||
    info.imageLinks?.smallThumbnail ||
    "";
  return GetBookByIsbnResponse.parse({
    isbn: isbn13 || isbn10 || isbn,
    title: info.title || "Unknown Title",
    authors: Array.isArray(info.authors) ? info.authors : [],
    description: info.description || "",
    pageCount: typeof info.pageCount === "number" ? info.pageCount : 0,
    coverUrl: thumbnail.replace("http://", "https://"),
    publisher: info.publisher || "",
    publishedDate: info.publishedDate || "",
    categories: Array.isArray(info.categories) ? info.categories : [],
    language: info.language || "en",
  });
}

booksRouter.get("/books/isbn/:isbn", async (req, res) => {
  const isbn = normalizeIsbn(req.params.isbn ?? "");
  if (!isbn) {
    res.status(400).json({ message: "Invalid ISBN" });
    return;
  }

  const apiKey = process.env.GOOGLE_BOOKS_API_KEY;
  const params = new URLSearchParams({ q: `isbn:${isbn}` });
  if (apiKey) {
    params.set("key", apiKey);
  } else {
    req.log.warn("GOOGLE_BOOKS_API_KEY is not set; using unauthenticated Google Books access");
  }
  const url = `https://www.googleapis.com/books/v1/volumes?${params.toString()}`;

  let googleResp: globalThis.Response;
  let bodyText: string;
  try {
    googleResp = await fetch(url);
    bodyText = await googleResp.text();
  } catch (err) {
    req.log.error({ err, isbn }, "Google Books request failed");
    res.status(502).json({ message: "Book catalog service is unreachable" });
    return;
  }

  if (!googleResp.ok) {
    // Never log the URL (it may contain the API key); log status + body only.
    req.log.error(
      { isbn, googleStatus: googleResp.status, googleBody: bodyText.slice(0, 2000) },
      "Google Books returned an error",
    );
    res.status(502).json({
      message: `Book catalog service error (upstream status ${googleResp.status})`,
    });
    return;
  }

  let data: any;
  try {
    data = JSON.parse(bodyText);
  } catch {
    req.log.error(
      { isbn, googleStatus: googleResp.status },
      "Google Books returned non-JSON body",
    );
    res.status(502).json({ message: "Book catalog returned an invalid response" });
    return;
  }

  req.log.info(
    { isbn, googleStatus: googleResp.status, totalItems: data.totalItems ?? 0 },
    "Google Books lookup",
  );

  if (!Array.isArray(data.items) || data.items.length === 0) {
    res.status(404).json({ message: "No book found for this ISBN" });
    return;
  }

  try {
    res.json(volumeInfoToBook(isbn, data.items[0]));
  } catch (err) {
    req.log.error({ err, isbn }, "Failed to map Google Books volume");
    res.status(502).json({ message: "Book catalog returned an unexpected format" });
  }
});

export default booksRouter;
