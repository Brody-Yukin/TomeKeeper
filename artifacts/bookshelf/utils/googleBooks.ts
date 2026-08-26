/** Builds an absolute URL to the app's API server. */
export function apiUrl(path: string): string {
  const base = process.env.EXPO_PUBLIC_API_URL;
  if (base) return `${base.replace(/\/$/, "")}${path}`;
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (domain) return `https://${domain}${path}`;
  return path;
}

/** Thrown by fetchBookByISBN when the lookup fails for reasons other than "not found". */
export class BookLookupError extends Error {
  constructor(
    public kind: "network" | "catalog",
    message: string,
  ) {
    super(message);
    this.name = "BookLookupError";
  }
}

export interface BookInfo {
  isbn: string;
  title: string;
  authors: string[];
  description: string;
  pageCount: number;
  coverUrl: string;
  publisher: string;
  publishedDate: string;
  categories: string[];
  language: string;
}

export interface CoverSearchParams {
  title: string;
  author?: string;
  publisher?: string;
  editionText?: string;
}

function toWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

function wordOverlap(queryWords: string[], target: string): number {
  if (queryWords.length === 0) return 0;
  const targetWords = new Set(toWords(target));
  const hits = queryWords.filter((w) => targetWords.has(w)).length;
  return hits / queryWords.length;
}

/**
 * Score a candidate against the extracted cover analysis. Higher is better.
 */
function scoreCandidate(book: BookInfo, params: CoverSearchParams): number {
  let score = 0;
  score += wordOverlap(toWords(params.title), book.title) * 4;
  if (params.author) {
    score += wordOverlap(toWords(params.author), book.authors.join(" ")) * 3;
  }
  if (params.publisher) {
    score += wordOverlap(toWords(params.publisher), book.publisher) * 2;
  }
  if (params.editionText) {
    // Edition words may appear in the title or subtitle of a specific edition.
    score += wordOverlap(toWords(params.editionText), book.title) * 1.5;
  }
  return score;
}

function normalizeIsbn(value: string): string {
  return value.replace(/[\s-]/g, "").toUpperCase();
}

/**
 * Search the server-side catalog using everything extracted from the cover,
 * returning multiple candidate editions ranked by how well they match —
 * never auto-picking the first result.
 */
export async function searchBooksByTitleAuthor(
  params: CoverSearchParams,
): Promise<BookInfo[]> {
  const title = params.title.trim();
  if (!title) return [];

  const searchParams = new URLSearchParams({ title });
  if (params.author?.trim()) searchParams.set("author", params.author.trim());
  if (params.publisher?.trim())
    searchParams.set("publisher", params.publisher.trim());

  let response: Response;
  try {
    response = await fetch(
      apiUrl(`/api/books/search?${searchParams.toString()}`),
    );
  } catch {
    throw new BookLookupError("network", "Could not reach the server");
  }
  if (response.status === 404) return [];
  if (!response.ok) {
    throw new BookLookupError(
      "catalog",
      `Book catalog error (${response.status})`,
    );
  }
  const items = (await response.json()) as BookInfo[];

  const seen = new Set<string>();
  const results: BookInfo[] = [];
  for (const book of items) {
    const isbn = normalizeIsbn(book.isbn);
    if (!isbn || seen.has(isbn)) continue;
    seen.add(isbn);
    results.push(book);
  }

  return results
    .map((book) => ({ book, score: scoreCandidate(book, params) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .map(({ book }) => book);
}

/**
 * Look up a book by ISBN through the app's API server (which queries the
 * catalog with a server-only key).
 *
 * Returns null when the catalog has no book for this ISBN (or the ISBN is
 * invalid). Throws BookLookupError("network") when the API server can't be
 * reached, and BookLookupError("catalog") when the catalog service fails.
 */
export async function fetchBookByISBN(isbn: string): Promise<BookInfo | null> {
  const clean = isbn.replace(/[^0-9X]/gi, "");

  let resp: Response;
  try {
    resp = await fetch(apiUrl(`/api/books/isbn/${encodeURIComponent(clean)}`));
  } catch {
    throw new BookLookupError("network", "Could not reach the server");
  }

  if (resp.status === 404 || resp.status === 400) return null;
  if (!resp.ok) {
    throw new BookLookupError("catalog", `Book catalog error (${resp.status})`);
  }

  const book = (await resp.json()) as BookInfo;
  return book;
}
