import { Router, type IRouter, type Request, type Response } from "express";
import { getAuth } from "@clerk/express";
import { eq, and, desc } from "drizzle-orm";
import { db, libraryBooksTable, type LibraryBookRow } from "@workspace/db";
import {
  AddLibraryBookBody,
  ImportLibraryBooksBody,
  UpdateLibraryBookBody,
} from "@workspace/api-zod";

const libraryRouter: IRouter = Router();

/** Returns the Clerk user id, or sends 401 and returns null. */
function requireUserId(req: Request, res: Response): string | null {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ message: "Authentication required" });
    return null;
  }
  return userId;
}

function rowToBook(row: LibraryBookRow) {
  return {
    id: row.id,
    isbn: row.isbn,
    title: row.title,
    authors: row.authors,
    description: row.description,
    pageCount: row.pageCount,
    currentPage: row.currentPage,
    coverUrl: row.coverUrl,
    publisher: row.publisher,
    publishedDate: row.publishedDate,
    categories: row.categories,
    language: row.language,
    status: row.status,
    dateAdded: row.dateAdded,
    ...(row.dateFinished != null ? { dateFinished: row.dateFinished } : {}),
    ...(row.rating != null ? { rating: row.rating } : {}),
  };
}

type BookInput = ReturnType<(typeof AddLibraryBookBody)["parse"]>;

function bookToRow(userId: string, book: BookInput) {
  return {
    userId,
    id: book.id,
    isbn: book.isbn,
    title: book.title,
    authors: book.authors,
    description: book.description,
    pageCount: Math.trunc(book.pageCount),
    currentPage: Math.trunc(book.currentPage),
    coverUrl: book.coverUrl,
    publisher: book.publisher,
    publishedDate: book.publishedDate,
    categories: book.categories,
    language: book.language,
    status: book.status,
    dateAdded: Math.trunc(book.dateAdded),
    dateFinished:
      book.dateFinished != null ? Math.trunc(book.dateFinished) : null,
    rating: book.rating != null ? Math.trunc(book.rating) : null,
  };
}

const upsertSet = {
  isbn: libraryBooksTable.isbn,
  title: libraryBooksTable.title,
  authors: libraryBooksTable.authors,
  description: libraryBooksTable.description,
  pageCount: libraryBooksTable.pageCount,
  currentPage: libraryBooksTable.currentPage,
  coverUrl: libraryBooksTable.coverUrl,
  publisher: libraryBooksTable.publisher,
  publishedDate: libraryBooksTable.publishedDate,
  categories: libraryBooksTable.categories,
  language: libraryBooksTable.language,
  status: libraryBooksTable.status,
  dateAdded: libraryBooksTable.dateAdded,
  dateFinished: libraryBooksTable.dateFinished,
  rating: libraryBooksTable.rating,
};

libraryRouter.get("/library", async (req, res) => {
  const userId = requireUserId(req, res);
  if (!userId) return;

  const rows = await db
    .select()
    .from(libraryBooksTable)
    .where(eq(libraryBooksTable.userId, userId))
    .orderBy(desc(libraryBooksTable.dateAdded));

  res.json(rows.map(rowToBook));
});

libraryRouter.post("/library", async (req, res) => {
  const userId = requireUserId(req, res);
  if (!userId) return;

  const parsed = AddLibraryBookBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid request body" });
    return;
  }

  const values = bookToRow(userId, parsed.data);
  const [row] = await db
    .insert(libraryBooksTable)
    .values(values)
    .onConflictDoUpdate({
      target: [libraryBooksTable.userId, libraryBooksTable.id],
      set: values,
    })
    .returning();

  res.json(rowToBook(row));
});

libraryRouter.post("/library/import", async (req, res) => {
  const userId = requireUserId(req, res);
  if (!userId) return;

  const parsed = ImportLibraryBooksBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid request body" });
    return;
  }

  // Upsert each book; existing server copies win only on identical ids
  // (the incoming copy overwrites, which matches "device migrates in").
  for (const book of parsed.data.books) {
    const values = bookToRow(userId, book);
    await db
      .insert(libraryBooksTable)
      .values(values)
      .onConflictDoUpdate({
        target: [libraryBooksTable.userId, libraryBooksTable.id],
        set: values,
      });
  }

  const rows = await db
    .select()
    .from(libraryBooksTable)
    .where(eq(libraryBooksTable.userId, userId))
    .orderBy(desc(libraryBooksTable.dateAdded));

  res.json(rows.map(rowToBook));
});

libraryRouter.patch("/library/:id", async (req, res) => {
  const userId = requireUserId(req, res);
  if (!userId) return;

  const parsed = UpdateLibraryBookBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid request body" });
    return;
  }

  const updates: Partial<LibraryBookRow> = {};
  if (parsed.data.status !== undefined) updates.status = parsed.data.status;
  if (parsed.data.currentPage !== undefined)
    updates.currentPage = Math.trunc(parsed.data.currentPage);
  if (parsed.data.rating !== undefined)
    updates.rating = Math.trunc(parsed.data.rating);
  if (parsed.data.dateFinished !== undefined)
    updates.dateFinished = Math.trunc(parsed.data.dateFinished);

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ message: "No fields to update" });
    return;
  }

  const [row] = await db
    .update(libraryBooksTable)
    .set(updates)
    .where(
      and(
        eq(libraryBooksTable.userId, userId),
        eq(libraryBooksTable.id, req.params.id),
      ),
    )
    .returning();

  if (!row) {
    res.status(404).json({ message: "Book not found" });
    return;
  }

  res.json(rowToBook(row));
});

libraryRouter.delete("/library/:id", async (req, res) => {
  const userId = requireUserId(req, res);
  if (!userId) return;

  await db
    .delete(libraryBooksTable)
    .where(
      and(
        eq(libraryBooksTable.userId, userId),
        eq(libraryBooksTable.id, req.params.id),
      ),
    );

  res.status(204).end();
});

export default libraryRouter;
