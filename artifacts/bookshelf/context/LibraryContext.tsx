import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "@clerk/expo";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  addLibraryBook,
  importLibraryBooks,
  listLibraryBooks,
  removeLibraryBook as apiRemoveLibraryBook,
  updateLibraryBook,
} from "@workspace/api-client-react";

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

interface LibraryContextType {
  books: Book[];
  isSyncing: boolean;
  addBook: (book: Omit<Book, "id" | "dateAdded" | "currentPage" | "status">) => void;
  removeBook: (id: string) => void;
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

/** Legacy device-wide storage key (pre-accounts). Migrated to the account on first sync. */
const LEGACY_STORAGE_KEY = "@bookshelf_library";
/** Per-user offline cache of the server library. */
const userCacheKey = (userId: string) => `@bookshelf_library:${userId}`;

const LibraryContext = createContext<LibraryContextType | null>(null);

/** Coerce anything stored on device / returned by the API into a Book. */
function normalizeBook(raw: any): Book {
  const status: ReadingStatus =
    raw?.status === "reading" || raw?.status === "read" ? raw.status : "unread";
  return {
    id: String(raw?.id ?? ""),
    isbn: String(raw?.isbn ?? ""),
    title: String(raw?.title ?? ""),
    authors: Array.isArray(raw?.authors) ? raw.authors.map(String) : [],
    description: String(raw?.description ?? ""),
    pageCount: Number(raw?.pageCount) || 0,
    currentPage: Number(raw?.currentPage) || 0,
    coverUrl: String(raw?.coverUrl ?? ""),
    publisher: String(raw?.publisher ?? ""),
    publishedDate: String(raw?.publishedDate ?? ""),
    categories: Array.isArray(raw?.categories) ? raw.categories.map(String) : [],
    language: String(raw?.language ?? "en"),
    status,
    dateAdded: Number(raw?.dateAdded) || Date.now(),
    ...(raw?.dateFinished != null ? { dateFinished: Number(raw.dateFinished) } : {}),
    ...(raw?.rating != null ? { rating: Number(raw.rating) } : {}),
  };
}

export function LibraryProvider({ children }: { children: React.ReactNode }) {
  const { isSignedIn, userId } = useAuth();
  const [books, setBooks] = useState<Book[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>("dateAdded");
  const [filterBy, setFilterBy] = useState<FilterOption>("all");
  const [groupBy, setGroupBy] = useState<GroupOption>("none");
  const booksRef = useRef(books);
  booksRef.current = books;

  // Load the cached library, then sync with the server. On the first sync
  // after sign-in, any legacy on-device library is migrated to the account.
  useEffect(() => {
    if (!isSignedIn || !userId) {
      setBooks([]);
      return;
    }

    let cancelled = false;

    (async () => {
      // 1. Show the per-user offline cache immediately.
      try {
        const cached = await AsyncStorage.getItem(userCacheKey(userId));
        if (cached && !cancelled) {
          setBooks(JSON.parse(cached).map(normalizeBook));
        }
      } catch {
        // Cache is best-effort only.
      }

      // 2. Sync with the server (migrating any legacy device library).
      setIsSyncing(true);
      try {
        let serverBooks: Book[];
        const legacyRaw = await AsyncStorage.getItem(LEGACY_STORAGE_KEY);
        const legacyBooks: Book[] = legacyRaw
          ? JSON.parse(legacyRaw).map(normalizeBook)
          : [];

        if (legacyBooks.length > 0) {
          serverBooks = (
            await importLibraryBooks({ books: legacyBooks })
          ).map(normalizeBook);
          await AsyncStorage.removeItem(LEGACY_STORAGE_KEY);
        } else {
          if (legacyRaw) await AsyncStorage.removeItem(LEGACY_STORAGE_KEY);
          serverBooks = (await listLibraryBooks()).map(normalizeBook);
        }

        if (!cancelled) {
          setBooks(serverBooks);
          await AsyncStorage.setItem(
            userCacheKey(userId),
            JSON.stringify(serverBooks),
          );
        }
      } catch (err) {
        console.warn("Library sync failed; showing cached copy", err);
      } finally {
        if (!cancelled) setIsSyncing(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isSignedIn, userId]);

  /** Apply an optimistic local update and persist it to the per-user cache. */
  const applyLocal = useCallback(
    (updated: Book[]) => {
      setBooks(updated);
      if (userId) {
        AsyncStorage.setItem(userCacheKey(userId), JSON.stringify(updated)).catch(
          () => {},
        );
      }
    },
    [userId],
  );

  const addBook = useCallback(
    (book: Omit<Book, "id" | "dateAdded" | "currentPage" | "status">) => {
      const newBook: Book = {
        ...book,
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        dateAdded: Date.now(),
        currentPage: 0,
        status: "unread",
      };
      applyLocal([newBook, ...booksRef.current]);
      addLibraryBook(newBook).catch((err) =>
        console.warn("Failed to sync new book", err),
      );
    },
    [applyLocal],
  );

  const removeBook = useCallback(
    (id: string) => {
      applyLocal(booksRef.current.filter((b) => b.id !== id));
      apiRemoveLibraryBook(id).catch((err) =>
        console.warn("Failed to sync book removal", err),
      );
    },
    [applyLocal],
  );

  const updateStatus = useCallback(
    (id: string, status: ReadingStatus) => {
      const dateFinished =
        status === "read"
          ? Date.now()
          : booksRef.current.find((b) => b.id === id)?.dateFinished;
      applyLocal(
        booksRef.current.map((b) =>
          b.id === id ? { ...b, status, dateFinished } : b,
        ),
      );
      updateLibraryBook(id, {
        status,
        ...(dateFinished != null ? { dateFinished } : {}),
      }).catch((err) => console.warn("Failed to sync status", err));
    },
    [applyLocal],
  );

  const updateCurrentPage = useCallback(
    (id: string, page: number) => {
      applyLocal(
        booksRef.current.map((b) => (b.id === id ? { ...b, currentPage: page } : b)),
      );
      updateLibraryBook(id, { currentPage: page }).catch((err) =>
        console.warn("Failed to sync progress", err),
      );
    },
    [applyLocal],
  );

  const updateRating = useCallback(
    (id: string, rating: number) => {
      applyLocal(
        booksRef.current.map((b) => (b.id === id ? { ...b, rating } : b)),
      );
      updateLibraryBook(id, { rating }).catch((err) =>
        console.warn("Failed to sync rating", err),
      );
    },
    [applyLocal],
  );

  const hasBook = useCallback(
    (isbn: string) => books.some((b) => b.isbn === isbn),
    [books],
  );

  return (
    <LibraryContext.Provider
      value={{
        books,
        isSyncing,
        addBook,
        removeBook,
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
