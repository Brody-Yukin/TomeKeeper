import {
  pgTable,
  text,
  integer,
  jsonb,
  bigint,
  primaryKey,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * A user's library books, keyed by (userId, id) where userId is the Clerk
 * user id and id is the client-generated book id (kept stable so on-device
 * libraries can migrate without re-keying).
 */
export const libraryBooksTable = pgTable(
  "library_books",
  {
    userId: text("user_id").notNull(),
    id: text("id").notNull(),
    isbn: text("isbn").notNull(),
    title: text("title").notNull(),
    authors: jsonb("authors").$type<string[]>().notNull().default([]),
    description: text("description").notNull().default(""),
    pageCount: integer("page_count").notNull().default(0),
    currentPage: integer("current_page").notNull().default(0),
    coverUrl: text("cover_url").notNull().default(""),
    publisher: text("publisher").notNull().default(""),
    publishedDate: text("published_date").notNull().default(""),
    categories: jsonb("categories").$type<string[]>().notNull().default([]),
    language: text("language").notNull().default("en"),
    status: text("status").notNull().default("unread"),
    dateAdded: bigint("date_added", { mode: "number" }).notNull(),
    dateFinished: bigint("date_finished", { mode: "number" }),
    rating: integer("rating"),
  },
  (table) => [primaryKey({ columns: [table.userId, table.id] })],
);

export const insertLibraryBookSchema = createInsertSchema(libraryBooksTable);
export type InsertLibraryBook = z.infer<typeof insertLibraryBookSchema>;
export type LibraryBookRow = typeof libraryBooksTable.$inferSelect;
