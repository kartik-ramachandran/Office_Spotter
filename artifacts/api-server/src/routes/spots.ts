import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, parkingSpotsTable, employeesTable } from "@workspace/db";
import {
  CreateSpotBody,
  UpdateSpotParams,
  UpdateSpotBody,
  DeleteSpotParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

async function enrichSpot(spot: typeof parkingSpotsTable.$inferSelect) {
  let permanentEmployeeName: string | null = null;
  if (spot.permanentEmployeeId) {
    const [emp] = await db
      .select()
      .from(employeesTable)
      .where(eq(employeesTable.id, spot.permanentEmployeeId));
    permanentEmployeeName = emp?.name ?? null;
  }
  return {
    id: spot.id,
    label: spot.label,
    type: spot.type,
    zone: spot.zone ?? null,
    permanentEmployeeId: spot.permanentEmployeeId ?? null,
    permanentEmployeeName,
  };
}

router.get("/spots", async (_req, res): Promise<void> => {
  const spots = await db.select().from(parkingSpotsTable).orderBy(parkingSpotsTable.label);
  const enriched = await Promise.all(spots.map(enrichSpot));
  res.json(enriched);
});

router.post("/spots", async (req, res): Promise<void> => {
  const parsed = CreateSpotBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [spot] = await db.insert(parkingSpotsTable).values(parsed.data).returning();

  // If permanent, sync employee's permanentSpotId
  if (spot.permanentEmployeeId) {
    await db
      .update(employeesTable)
      .set({ permanentSpotId: spot.id })
      .where(eq(employeesTable.id, spot.permanentEmployeeId));
  }

  res.status(201).json(await enrichSpot(spot));
});

router.patch("/spots/:id", async (req, res): Promise<void> => {
  const params = UpdateSpotParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateSpotBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [existing] = await db
    .select()
    .from(parkingSpotsTable)
    .where(eq(parkingSpotsTable.id, params.data.id));
  if (!existing) {
    res.status(404).json({ error: "Spot not found" });
    return;
  }

  // Clear old permanent employee's spot link if changing assignment
  if (
    existing.permanentEmployeeId &&
    parsed.data.permanentEmployeeId !== existing.permanentEmployeeId
  ) {
    await db
      .update(employeesTable)
      .set({ permanentSpotId: null })
      .where(eq(employeesTable.id, existing.permanentEmployeeId));
  }

  const [spot] = await db
    .update(parkingSpotsTable)
    .set(parsed.data)
    .where(eq(parkingSpotsTable.id, params.data.id))
    .returning();

  // Sync new permanent employee's spot link
  if (spot.permanentEmployeeId) {
    await db
      .update(employeesTable)
      .set({ permanentSpotId: spot.id })
      .where(eq(employeesTable.id, spot.permanentEmployeeId));
  }

  res.json(await enrichSpot(spot));
});

router.delete("/spots/:id", async (req, res): Promise<void> => {
  const params = DeleteSpotParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [spot] = await db
    .delete(parkingSpotsTable)
    .where(eq(parkingSpotsTable.id, params.data.id))
    .returning();
  if (!spot) {
    res.status(404).json({ error: "Spot not found" });
    return;
  }
  // Clear employee's permanentSpotId if it referenced this spot
  if (spot.permanentEmployeeId) {
    await db
      .update(employeesTable)
      .set({ permanentSpotId: null })
      .where(eq(employeesTable.id, spot.permanentEmployeeId));
  }
  res.sendStatus(204);
});

export default router;
