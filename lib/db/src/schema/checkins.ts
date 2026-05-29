import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const checkinsTable = sqliteTable("checkins", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  employeeId: integer("employee_id").notNull(),
  date: text("date").notNull(), // stored as YYYY-MM-DD text
  status: text("status").notNull().default("in_office"), // "in_office" | "wfh"
  spotId: integer("spot_id"),
  notes: text("notes"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()).$onUpdate(() => new Date()),
});

export const insertCheckinSchema = createInsertSchema(checkinsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCheckin = z.infer<typeof insertCheckinSchema>;
export type Checkin = typeof checkinsTable.$inferSelect;
