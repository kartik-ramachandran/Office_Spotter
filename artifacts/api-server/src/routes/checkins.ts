import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, checkinsTable, employeesTable, parkingSpotsTable } from "@workspace/db";
import {
  ListCheckinsQueryParams,
  CreateCheckinBody,
  UpdateCheckinParams,
  UpdateCheckinBody,
  DeleteCheckinParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

async function enrichCheckin(checkin: typeof checkinsTable.$inferSelect) {
  const [emp] = await db
    .select()
    .from(employeesTable)
    .where(eq(employeesTable.id, checkin.employeeId));

  let spotLabel: string | null = null;
  if (checkin.spotId) {
    const [spot] = await db
      .select()
      .from(parkingSpotsTable)
      .where(eq(parkingSpotsTable.id, checkin.spotId));
    spotLabel = spot?.label ?? null;
  }

  return {
    id: checkin.id,
    employeeId: checkin.employeeId,
    employeeName: emp?.name ?? "Unknown",
    date: checkin.date,
    status: checkin.status,
    spotId: checkin.spotId ?? null,
    spotLabel,
    notes: checkin.notes ?? null,
  };
}

router.get("/checkins", async (req, res): Promise<void> => {
  const query = ListCheckinsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  let rows;
  if (query.data.date) {
    rows = await db
      .select()
      .from(checkinsTable)
      .where(eq(checkinsTable.date, query.data.date))
      .orderBy(checkinsTable.createdAt);
  } else {
    rows = await db.select().from(checkinsTable).orderBy(checkinsTable.createdAt);
  }

  const enriched = await Promise.all(rows.map(enrichCheckin));
  res.json(enriched);
});

router.post("/checkins", async (req, res): Promise<void> => {
  const parsed = CreateCheckinBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  // Check for existing checkin by same employee on same date
  const [existing] = await db
    .select()
    .from(checkinsTable)
    .where(
      and(
        eq(checkinsTable.employeeId, parsed.data.employeeId),
        eq(checkinsTable.date, parsed.data.date)
      )
    );
  if (existing) {
    res.status(409).json({ error: "Employee already checked in for this date" });
    return;
  }

  let spotId: number | null = null;

  if (parsed.data.status === "in_office") {
    // Check if employee has a permanent spot
    const [emp] = await db
      .select()
      .from(employeesTable)
      .where(eq(employeesTable.id, parsed.data.employeeId));

    if (emp?.permanentSpotId) {
      spotId = emp.permanentSpotId;
    } else {
      // Find an available flexible spot not already taken today
      const takenSpotIds = await db
        .select({ spotId: checkinsTable.spotId })
        .from(checkinsTable)
        .where(and(eq(checkinsTable.date, parsed.data.date)));

      const takenIds = takenSpotIds
        .map((r) => r.spotId)
        .filter((id): id is number => id !== null);

      const flexSpots = await db
        .select()
        .from(parkingSpotsTable)
        .where(eq(parkingSpotsTable.type, "flexible"));

      const available = flexSpots.find((s) => !takenIds.includes(s.id));
      if (available) {
        spotId = available.id;
      }
    }
  }

  const [checkin] = await db
    .insert(checkinsTable)
    .values({ ...parsed.data, spotId })
    .returning();

  res.status(201).json(await enrichCheckin(checkin));
});

router.patch("/checkins/:id", async (req, res): Promise<void> => {
  const params = UpdateCheckinParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateCheckinBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [checkin] = await db
    .update(checkinsTable)
    .set(parsed.data)
    .where(eq(checkinsTable.id, params.data.id))
    .returning();

  if (!checkin) {
    res.status(404).json({ error: "Checkin not found" });
    return;
  }

  res.json(await enrichCheckin(checkin));
});

router.delete("/checkins/:id", async (req, res): Promise<void> => {
  const params = DeleteCheckinParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [checkin] = await db
    .delete(checkinsTable)
    .where(eq(checkinsTable.id, params.data.id))
    .returning();
  if (!checkin) {
    res.status(404).json({ error: "Checkin not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
