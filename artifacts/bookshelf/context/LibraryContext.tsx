import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

export type ReadingStatus = "unread" | "reading" | "read";

export interface Book {
  id: string;
  isbn: string;
  title: string;
  authors: string[];
  description: string;
  pageCount: number;
  currentPage: number;
  coverUrl: string;
  publisher: string;
  publishedDate: string;
  categories: string[];
  language: string;
  status: ReadingStatus;
  dateAdded: number;
  dateFinished?: number;
  rating?: number;
}

export type SortOption = "dateAdded" | "title" | "author" | "pageCount";
export type GroupOption = "none" | "status" | "category";
export type FilterOption = "all" | "read" | "reading" | "unread";
export type AddBookResult =
  | { added: true }
  | { added: false; reason: "duplicate" | "loading" };

/** Removes display-only ISBN formatting while preserving an ISBN-10 check digit. */
export function normalizeIsbn(isbn: string): string {
  return isbn.replace(/[\s-]/g, "").toUpperCase();
}

/** Returns whether a normalized ISBN-10 or ISBN-13 has a valid checksum. */
export function isValidIsbn(isbn: string): boolean {
  const normalized = normalizeIsbn(isbn);

  if (/^\d{13}$/.test(normalized)) {
    const checksum = normalized
      .slice(0, 12)
      .split("")
      .reduce(
        (sum, digit, index) => sum + Number(digit) * (index % 2 === 0 ? 1 : 3),
        0,
      );
    return (10 - (checksum % 10)) % 10 === Number(normalized[12]);
  }

  if (/^\d{9}[\dX]$/.test(normalized)) {
    const checksum = normalized.split("").reduce((sum, digit, index) => {
      const value = digit === "X" ? 10 : Number(digit);
      return sum + value * (10 - index);
    }, 0);
    return checksum % 11 === 0;
  }

  return false;
}

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(
    Math.max(Number.isFinite(value) ? value : minimum, minimum),
    maximum,
  );

interface LibraryContextType {
  books: Book[];
  isLoading: boolean;
  addBook: (
    book: Omit<Book, "id" | "dateAdded" | "currentPage" | "status">,
  ) => AddBookResult;
  removeBook: (id: string) => void;
  clearBooks: () => void;
  updateStatus: (id: string, status: ReadingStatus) => void;
  updateCurrentPage: (id: string, page: number) => void;
  updateRating: (id: string, rating: number) => void;
  hasBook: (isbn: string) => boolean;
  sortBy: SortOption;
  setSortBy: (s: SortOption) => void;
  filterBy: FilterOption;
  setFilterBy: (f: FilterOption) => void;
  groupBy: GroupOption;
  setGroupBy: (g: GroupOption) => void;
}

const STORAGE_KEY = "@bookshelf_library";

const LibraryContext = createContext<LibraryContextType | null>(null);

export function LibraryProvider({ children }: { children: React.ReactNode }) {
  const [books, setBooks] = useState<Book[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sortBy, setSortBy] = useState<SortOption>("dateAdded");
  const [filterBy, setFilterBy] = useState<FilterOption>("all");
  const [groupBy, setGroupBy] = useState<GroupOption>("none");
  const booksRef = useRef<Book[]>([]);
  const storageLoadedRef = useRef(false);
  const writeQueueRef = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    let isMounted = true;

    const loadBooks = async () => {
      try {
        const data = await AsyncStorage.getItem(STORAGE_KEY);
        const loadedBooks = data ? JSON.parse(data) : [];
        if (!Array.isArray(loadedBooks)) {
          throw new Error("Stored library is not an array");
        }
        if (isMounted) {
          storageLoadedRef.current = true;
          booksRef.current = loadedBooks;
          setBooks((current) =>
            current === loadedBooks ? current : loadedBooks,
          );
        }
      } catch (error) {
        console.warn("Unable to load library from storage.", error);
      } finally {
        if (isMounted) {
          // Even a failed read must unlock later writes; otherwise the
          // in-memory library would appear to work but never persist.
          storageLoadedRef.current = true;
          setIsLoading(false);
        }
      }
    };

    void loadBooks();
    return () => {
      isMounted = false;
    };
  }, []);

  const persistBooks = useCallback((updated: Book[]) => {
    const serializedBooks = updated.map((book) => ({
      ...book,
      isbn: normalizeIsbn(book.isbn),
    }));
    writeQueueRef.current = writeQueueRef.current
      .catch(() => undefined)
      .then(() =>
        AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(serializedBooks)),
      )
      .catch((error) => {
        console.warn("Unable to save library to storage.", error);
      });
  }, []);

  useEffect(() => {
    // Do not let the initial empty state overwrite storage before it is loaded.
    if (!isLoading && storageLoadedRef.current) {
      persistBooks(books);
    }
  }, [books, isLoading, persistBooks]);

  const addBook = useCallback(
    (
      book: Omit<Book, "id" | "dateAdded" | "currentPage" | "status">,
    ): AddBookResult => {
      if (isLoading) {
        return { added: false, reason: "loading" };
      }

      const isbn = normalizeIsbn(book.isbn);
      if (
        isbn &&
        booksRef.current.some(
          (existing) => normalizeIsbn(existing.isbn) === isbn,
        )
      ) {
        return { added: false, reason: "duplicate" };
      }

      const newBook: Book = {
        ...book,
        isbn,
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        dateAdded: Date.now(),
        currentPage: 0,
        status: "unread",
      };

      // Update the ref before scheduling state so rapid presses cannot add the same ISBN twice.
      booksRef.current = [newBook, ...booksRef.current];
      let wasAdded = true;
      setBooks((current) => {
        if (
          isbn &&
          current.some((existing) => normalizeIsbn(existing.isbn) === isbn)
        ) {
          booksRef.current = current;
          wasAdded = false;
          return current;
        }
        const updated = [newBook, ...current];
        booksRef.current = updated;
        return updated;
      });
      return wasAdded ? { added: true } : { added: false, reason: "duplicate" };
    },
    [isLoading],
  );

  const removeBook = useCallback(
    (id: string) => {
      if (isLoading) return;
      setBooks((current) => {
        const updated = current.filter((book) => book.id !== id);
        booksRef.current = updated;
        return updated;
      });
    },
    [isLoading],
  );

  const clearBooks = useCallback(() => {
    if (isLoading) return;
    setBooks((current) => {
      const updated = current.filter(() => false);
      booksRef.current = updated;
      return updated;
    });
  }, [isLoading]);

  const updateStatus = useCallback(
    (id: string, status: ReadingStatus) => {
      if (isLoading) return;
      setBooks((current) => {
        const updated = current.map((b) =>
          b.id === id
            ? {
                ...b,
                status,
                dateFinished:
                  status === "read"
                    ? (b.dateFinished ?? Date.now())
                    : undefined,
              }
            : b,
        );
        booksRef.current = updated;
        return updated;
      });
    },
    [isLoading],
  );

  const updateCurrentPage = useCallback(
    (id: string, page: number) => {
      if (isLoading) return;
      setBooks((current) => {
        const updated = current.map((book) =>
          book.id === id
            ? {
                ...book,
                currentPage: clamp(
                  Math.floor(page),
                  0,
                  Math.max(0, book.pageCount),
                ),
              }
            : book,
        );
        booksRef.current = updated;
        return updated;
      });
    },
    [isLoading],
  );

  const updateRating = useCallback(
    (id: string, rating: number) => {
      if (isLoading) return;
      setBooks((current) => {
        const updated = current.map((book) =>
          book.id === id
            ? { ...book, rating: clamp(Math.round(rating), 1, 5) }
            : book,
        );
        booksRef.current = updated;
        return updated;
      });
    },
    [isLoading],
  );

  const hasBook = useCallback((isbn: string) => {
    const normalized = normalizeIsbn(isbn);
    return (
      normalized !== "" &&
      booksRef.current.some((book) => normalizeIsbn(book.isbn) === normalized)
    );
  }, []);

  return (
    <LibraryContext.Provider
      value={{
        books,
        isLoading,
        addBook,
        removeBook,
        clearBooks,
        updateStatus,
        updateCurrentPage,
        updateRating,
        hasBook,
        sortBy,
        setSortBy,
        filterBy,
        setFilterBy,
        groupBy,
        setGroupBy,
      }}
    >
      {children}
    </LibraryContext.Provider>
  );
}

export function useLibrary() {
  const ctx = useContext(LibraryContext);
  if (!ctx) throw new Error("useLibrary must be used within LibraryProvider");
  return ctx;
}
