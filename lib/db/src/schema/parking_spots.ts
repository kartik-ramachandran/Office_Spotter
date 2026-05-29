import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const parkingSpotsTable = sqliteTable("parking_spots", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  label: text("label").notNull(),
  type: text("type").notNull().default("flexible"), // "permanent" | "flexible"
  zone: text("zone"),
  permanentEmployeeId: integer("permanent_employee_id"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()).$onUpdate(() => new Date()),
});

export const insertParkingSpotSchema = createInsertSchema(parkingSpotsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertParkingSpot = z.infer<typeof insertParkingSpotSchema>;
export type ParkingSpot = typeof parkingSpotsTable.$inferSelect;
