import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
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

interface LibraryContextType {
  books: Book[];
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

const STORAGE_KEY = "@bookshelf_library";

const LibraryContext = createContext<LibraryContextType | null>(null);

export function LibraryProvider({ children }: { children: React.ReactNode }) {
  const [books, setBooks] = useState<Book[]>([]);
  const [sortBy, setSortBy] = useState<SortOption>("dateAdded");
  const [filterBy, setFilterBy] = useState<FilterOption>("all");
  const [groupBy, setGroupBy] = useState<GroupOption>("none");

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((data) => {
      if (data) {
        setBooks(JSON.parse(data));
      }
    });
  }, []);

  const persist = useCallback((updated: Book[]) => {
    setBooks(updated);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }, []);

  const addBook = useCallback(
    (book: Omit<Book, "id" | "dateAdded" | "currentPage" | "status">) => {
      const newBook: Book = {
        ...book,
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        dateAdded: Date.now(),
        currentPage: 0,
        status: "unread",
      };
      persist([newBook, ...books]);
    },
    [books, persist]
  );

  const removeBook = useCallback(
    (id: string) => {
      persist(books.filter((b) => b.id !== id));
    },
    [books, persist]
  );

  const updateStatus = useCallback(
    (id: string, status: ReadingStatus) => {
      persist(
        books.map((b) =>
          b.id === id
            ? {
                ...b,
                status,
                dateFinished: status === "read" ? Date.now() : b.dateFinished,
              }
            : b
        )
      );
    },
    [books, persist]
  );

  const updateCurrentPage = useCallback(
    (id: string, page: number) => {
      persist(books.map((b) => (b.id === id ? { ...b, currentPage: page } : b)));
    },
    [books, persist]
  );

  const updateRating = useCallback(
    (id: string, rating: number) => {
      persist(books.map((b) => (b.id === id ? { ...b, rating } : b)));
    },
    [books, persist]
  );

  const hasBook = useCallback(
    (isbn: string) => books.some((b) => b.isbn === isbn),
    [books]
  );

  return (
    <LibraryContext.Provider
      value={{
        books,
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
