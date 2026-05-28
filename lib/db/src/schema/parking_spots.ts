import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const parkingSpotsTable = pgTable("parking_spots", {
  id: serial("id").primaryKey(),
  label: text("label").notNull(),
  type: text("type").notNull().default("flexible"), // "permanent" | "flexible"
  zone: text("zone"),
  permanentEmployeeId: integer("permanent_employee_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertParkingSpotSchema = createInsertSchema(parkingSpotsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertParkingSpot = z.infer<typeof insertParkingSpotSchema>;
export type ParkingSpot = typeof parkingSpotsTable.$inferSelect;
