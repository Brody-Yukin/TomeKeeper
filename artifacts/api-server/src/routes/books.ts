import { Router, type IRouter } from "express";
import {
  IdentifyBookCoverBody,
  IdentifyBookCoverResponse,
  GetBookByIsbnResponse,
  SearchBooksQueryParams,
  SearchBooksResponse,
} from "@workspace/api-zod";
import { getOpenAIClient } from "@workspace/integrations-openai-ai-server";

const booksRouter: IRouter = Router();

const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB

// Note: the JSON body parser for this route (12 MB limit) is configured
// path-specifically in app.ts, before the global 100kb parser.

// Matches standard base64 (with optional padding), length divisible by 4.
const BASE64_RE =
  /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

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
    const openai = getOpenAIClient();
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

type CatalogResult<T> =
  | { kind: "match"; value: T }
  | { kind: "no-match" }
  | { kind: "failure" };

type BookDetails = ReturnType<typeof GetBookByIsbnResponse.parse>;

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function normalizedCandidateIsbn(value: unknown): string {
  return typeof value === "string" ? (normalizeIsbn(value) ?? "") : "";
}

function googleVolumeToBook(
  volume: unknown,
  requestedIsbn = "",
): BookDetails | null {
  if (!volume || typeof volume !== "object") return null;
  const info = (volume as { volumeInfo?: unknown }).volumeInfo;
  if (!info || typeof info !== "object") return null;
  const record = info as Record<string, unknown>;
  if (typeof record.title !== "string" || !record.title.trim()) return null;
  const identifiers = Array.isArray(record.industryIdentifiers)
    ? record.industryIdentifiers
    : [];
  const isbn13 = identifiers
    .map((item) =>
      item &&
      typeof item === "object" &&
      (item as Record<string, unknown>).type === "ISBN_13"
        ? normalizedCandidateIsbn((item as Record<string, unknown>).identifier)
        : "",
    )
    .find(Boolean);
  const isbn10 = identifiers
    .map((item) =>
      item &&
      typeof item === "object" &&
      (item as Record<string, unknown>).type === "ISBN_10"
        ? normalizedCandidateIsbn((item as Record<string, unknown>).identifier)
        : "",
    )
    .find(Boolean);
  const imageLinks =
    record.imageLinks && typeof record.imageLinks === "object"
      ? (record.imageLinks as Record<string, unknown>)
      : {};
  const thumbnail =
    [
      imageLinks.extraLarge,
      imageLinks.large,
      imageLinks.medium,
      imageLinks.thumbnail,
      imageLinks.smallThumbnail,
    ].find((value): value is string => typeof value === "string") ?? "";
  const isbn = isbn13 || isbn10 || requestedIsbn;
  if (!isbn) return null;
  return GetBookByIsbnResponse.parse({
    isbn,
    title: record.title.trim(),
    authors: strings(record.authors),
    description:
      typeof record.description === "string" ? record.description : "",
    pageCount: typeof record.pageCount === "number" ? record.pageCount : 0,
    coverUrl: thumbnail.replace("http://", "https://"),
    publisher: typeof record.publisher === "string" ? record.publisher : "",
    publishedDate:
      typeof record.publishedDate === "string" ? record.publishedDate : "",
    categories: strings(record.categories),
    language: typeof record.language === "string" ? record.language : "en",
  });
}

function openLibraryBookToBook(
  value: unknown,
  requestedIsbn = "",
): BookDetails | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (typeof record.title !== "string" || !record.title.trim()) return null;
  const isbn13 = strings(record.isbn_13)
    .map(normalizedCandidateIsbn)
    .find(Boolean);
  const isbn10 = strings(record.isbn_10)
    .map(normalizedCandidateIsbn)
    .find(Boolean);
  const cover =
    record.cover && typeof record.cover === "object"
      ? (record.cover as Record<string, unknown>)
      : {};
  const authors = Array.isArray(record.authors)
    ? record.authors.flatMap((author) =>
        author &&
        typeof author === "object" &&
        typeof (author as Record<string, unknown>).name === "string"
          ? [(author as Record<string, unknown>).name as string]
          : [],
      )
    : [];
  const publishers = Array.isArray(record.publishers)
    ? record.publishers.flatMap((publisher) =>
        publisher &&
        typeof publisher === "object" &&
        typeof (publisher as Record<string, unknown>).name === "string"
          ? [(publisher as Record<string, unknown>).name as string]
          : [],
      )
    : [];
  const isbn = isbn13 || isbn10 || requestedIsbn;
  if (!isbn) return null;
  return GetBookByIsbnResponse.parse({
    isbn,
    title: record.title.trim(),
    authors,
    description: typeof record.notes === "string" ? record.notes : "",
    pageCount:
      typeof record.number_of_pages === "number" ? record.number_of_pages : 0,
    coverUrl: (typeof cover.large === "string" ? cover.large : "").replace(
      "http://",
      "https://",
    ),
    publisher: publishers[0] ?? "",
    publishedDate:
      typeof record.publish_date === "string" ? record.publish_date : "",
    categories: strings(record.subjects),
    language: "en",
  });
}

async function googleSearch(
  query: string,
): Promise<CatalogResult<BookDetails[]>> {
  const apiKey = process.env.GOOGLE_BOOKS_API_KEY;
  if (!apiKey) return { kind: "failure" };
  const params = new URLSearchParams({
    q: query,
    maxResults: "20",
    printType: "books",
    key: apiKey,
  });
  try {
    const response = await fetch(
      `https://www.googleapis.com/books/v1/volumes?${params.toString()}`,
    );
    if (!response.ok) return { kind: "failure" };
    const data: unknown = await response.json();
    if (!data || typeof data !== "object") return { kind: "failure" };
    const items = (data as { items?: unknown }).items;
    if (!Array.isArray(items)) {
      return (data as { totalItems?: unknown }).totalItems === 0
        ? { kind: "no-match" }
        : { kind: "failure" };
    }
    const books = items
      .map((item) => googleVolumeToBook(item))
      .filter((book): book is BookDetails => book !== null);
    return books.length
      ? { kind: "match", value: books }
      : { kind: "no-match" };
  } catch {
    return { kind: "failure" };
  }
}

async function openLibrarySearch(
  params: Record<string, string>,
): Promise<CatalogResult<BookDetails[]>> {
  const search = new URLSearchParams({
    ...params,
    limit: "20",
    // Open Library's default field set no longer includes edition ISBNs.
    // Request the fields needed to build and deduplicate edition candidates.
    fields:
      "key,title,author_name,isbn,publisher,publish_year,cover_i,first_publish_year,number_of_pages_median,language,subject",
  });
  try {
    const response = await fetch(
      `https://openlibrary.org/search.json?${search.toString()}`,
    );
    if (!response.ok) return { kind: "failure" };
    const data: unknown = await response.json();
    if (
      !data ||
      typeof data !== "object" ||
      !Array.isArray((data as { docs?: unknown }).docs)
    ) {
      return { kind: "failure" };
    }
    const books = (data as { docs: unknown[] }).docs
      .map((doc) =>
        openLibraryBookToBook({
          ...((doc && typeof doc === "object" ? doc : {}) as Record<
            string,
            unknown
          >),
          authors: strings((doc as Record<string, unknown>)?.author_name).map(
            (name) => ({ name }),
          ),
          publishers: strings((doc as Record<string, unknown>)?.publisher).map(
            (name) => ({ name }),
          ),
          isbn_13: strings((doc as Record<string, unknown>)?.isbn).filter(
            (isbn) => isbn.length === 13,
          ),
          isbn_10: strings((doc as Record<string, unknown>)?.isbn).filter(
            (isbn) => isbn.length === 10,
          ),
          cover:
            typeof (doc as Record<string, unknown>)?.cover_i === "number"
              ? {
                  large: `https://covers.openlibrary.org/b/id/${(doc as Record<string, unknown>).cover_i}-L.jpg`,
                }
              : {},
          publish_date: Array.isArray(
            (doc as Record<string, unknown>)?.publish_year,
          )
            ? String(
                (
                  (doc as Record<string, unknown>).publish_year as unknown[]
                )[0] ?? "",
              )
            : typeof (doc as Record<string, unknown>)?.first_publish_year ===
                "number"
              ? String((doc as Record<string, unknown>).first_publish_year)
              : "",
          number_of_pages:
            typeof (doc as Record<string, unknown>)?.number_of_pages_median ===
            "number"
              ? (doc as Record<string, unknown>).number_of_pages_median
              : 0,
          subjects: strings((doc as Record<string, unknown>)?.subject),
        }),
      )
      .filter((book): book is BookDetails => book !== null);
    return books.length
      ? { kind: "match", value: books }
      : { kind: "no-match" };
  } catch {
    return { kind: "failure" };
  }
}

async function openLibraryIsbn(
  isbn: string,
): Promise<CatalogResult<BookDetails>> {
  try {
    const response = await fetch(
      `https://openlibrary.org/api/books?${new URLSearchParams({
        bibkeys: `ISBN:${isbn}`,
        format: "json",
        jscmd: "data",
      }).toString()}`,
    );
    if (!response.ok) return { kind: "failure" };
    const data: unknown = await response.json();
    if (!data || typeof data !== "object") return { kind: "failure" };
    const book = openLibraryBookToBook(
      (data as Record<string, unknown>)[`ISBN:${isbn}`],
      isbn,
    );
    return book ? { kind: "match", value: book } : { kind: "no-match" };
  } catch {
    return { kind: "failure" };
  }
}

function dedupeBooks(books: BookDetails[]): BookDetails[] {
  const seen = new Set<string>();
  return books.filter((book) => {
    const isbn = normalizedCandidateIsbn(book.isbn);
    if (!isbn || seen.has(isbn)) return false;
    seen.add(isbn);
    return true;
  });
}

booksRouter.get("/books/isbn/:isbn", async (req, res) => {
  const isbn = normalizeIsbn(req.params.isbn ?? "");
  if (!isbn) {
    res.status(400).json({ message: "Invalid ISBN" });
    return;
  }
  const google = await googleSearch(`isbn:${isbn}`);
  if (google.kind === "match") {
    res.json(google.value[0]);
    return;
  }
  const openLibrary = await openLibraryIsbn(isbn);
  if (openLibrary.kind === "match") {
    res.json(openLibrary.value);
    return;
  }
  res
    .status(
      google.kind === "no-match" && openLibrary.kind === "no-match" ? 404 : 502,
    )
    .json({
      message:
        google.kind === "no-match" && openLibrary.kind === "no-match"
          ? "No book found for this ISBN"
          : "Book catalog services failed",
    });
});

booksRouter.get("/books/search", async (req, res) => {
  const parsed = SearchBooksQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid search parameters" });
    return;
  }
  const title = parsed.data.title.trim();
  const author = parsed.data.author?.trim();
  const publisher = parsed.data.publisher?.trim();
  if (!title) {
    res.status(400).json({ message: "A title is required" });
    return;
  }
  const query = [
    `intitle:${title}`,
    author && `inauthor:${author}`,
    publisher && `inpublisher:${publisher}`,
  ]
    .filter(Boolean)
    .join("+");
  let google = await googleSearch(query);
  if (google.kind !== "match" && publisher) {
    const retry = await googleSearch(
      [`intitle:${title}`, author && `inauthor:${author}`]
        .filter(Boolean)
        .join("+"),
    );
    google =
      retry.kind === "match"
        ? retry
        : google.kind === "failure" || retry.kind === "failure"
          ? { kind: "failure" }
          : { kind: "no-match" };
  }
  if (google.kind === "match") {
    res.json(SearchBooksResponse.parse(dedupeBooks(google.value).slice(0, 20)));
    return;
  }
  const openLibrary = await openLibrarySearch({
    title,
    ...(author ? { author } : {}),
    ...(publisher ? { publisher } : {}),
  });
  if (openLibrary.kind === "match") {
    res.json(
      SearchBooksResponse.parse(dedupeBooks(openLibrary.value).slice(0, 20)),
    );
    return;
  }
  res
    .status(
      google.kind === "no-match" && openLibrary.kind === "no-match" ? 404 : 502,
    )
    .json({
      message:
        google.kind === "no-match" && openLibrary.kind === "no-match"
          ? "No books found"
          : "Book catalog services failed",
    });
});

export default booksRouter;
