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


function volumeToBookInfo(volume: any): BookInfo | null {
  const info = volume?.volumeInfo || {};
  if (!info.title) return null;

  const identifiers: { type: string; identifier: string }[] =
    info.industryIdentifiers || [];
  const isbn13 = identifiers.find((i) => i.type === "ISBN_13")?.identifier || "";
  const isbn10 = identifiers.find((i) => i.type === "ISBN_10")?.identifier || "";

  const thumbnail =
    info.imageLinks?.extraLarge ||
    info.imageLinks?.large ||
    info.imageLinks?.medium ||
    info.imageLinks?.thumbnail ||
    info.imageLinks?.smallThumbnail ||
    "";

  return {
    isbn: isbn13 || isbn10 || volume?.id || "",
    title: info.title || "Unknown Title",
    authors: info.authors || [],
    description: info.description || "",
    pageCount: info.pageCount || 0,
    coverUrl: thumbnail.replace("http://", "https://"),
    publisher: info.publisher || "",
    publishedDate: info.publishedDate || "",
    categories: info.categories || [],
    language: info.language || "en",
  };
}

/**
 * Search Google Books by title (and optionally author), returning multiple
 * candidate editions rather than automatically choosing the first result.
 */
export async function searchBooksByTitleAuthor(
  title: string,
  author?: string,
): Promise<BookInfo[]> {
  if (!title.trim()) return [];
  let q = `intitle:${title.trim()}`;
  if (author && author.trim()) {
    q += `+inauthor:${author.trim()}`;
  }
  const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=10&printType=books`;

  const resp = await fetch(url);
  if (!resp.ok) return [];

  const data = await resp.json();
  if (!data.items || data.items.length === 0) return [];

  const seen = new Set<string>();
  const results: BookInfo[] = [];
  for (const volume of data.items) {
    const book = volumeToBookInfo(volume);
    if (!book || !book.isbn || seen.has(book.isbn)) continue;
    seen.add(book.isbn);
    results.push(book);
  }
  return results;
}

export async function fetchBookByISBN(isbn: string): Promise<BookInfo | null> {
  const clean = isbn.replace(/[^0-9X]/gi, "");
  const url = `https://www.googleapis.com/books/v1/volumes?q=isbn:${clean}`;

  const resp = await fetch(url);
  if (!resp.ok) return null;

  const data = await resp.json();
  if (!data.items || data.items.length === 0) return null;

  const volume = data.items[0];
  const info = volume.volumeInfo || {};

  const identifiers: { type: string; identifier: string }[] =
    info.industryIdentifiers || [];
  const isbn13 = identifiers.find((i) => i.type === "ISBN_13")?.identifier || "";
  const isbn10 = identifiers.find((i) => i.type === "ISBN_10")?.identifier || "";

  const thumbnail =
    info.imageLinks?.extraLarge ||
    info.imageLinks?.large ||
    info.imageLinks?.medium ||
    info.imageLinks?.thumbnail ||
    info.imageLinks?.smallThumbnail ||
    "";

  const httpsThumb = thumbnail.replace("http://", "https://");

  return {
    isbn: isbn13 || isbn10 || clean,
    title: info.title || "Unknown Title",
    authors: info.authors || [],
    description: info.description || "",
    pageCount: info.pageCount || 0,
    coverUrl: httpsThumb,
    publisher: info.publisher || "",
    publishedDate: info.publishedDate || "",
    categories: info.categories || [],
    language: info.language || "en",
  };
}
