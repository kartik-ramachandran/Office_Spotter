import { Router, type IRouter } from "express";
import { eq, and, notInArray } from "drizzle-orm";
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

/**
 * Find all spot IDs already assigned on a given date.
 */
async function getTakenSpotIds(date: string): Promise<number[]> {
  const rows = await db
    .select({ spotId: checkinsTable.spotId })
    .from(checkinsTable)
    .where(eq(checkinsTable.date, date));
  return rows.map((r) => r.spotId).filter((id): id is number => id !== null);
}

/**
 * FIFO auto-assign: pick the next available spot for an in-office employee.
 *
 * Priority order:
 *  1. Employee's own permanent spot (if they have one).
 *  2. Any flexible spot not yet taken today (sorted by label).
 *  3. Any permanent spot whose owner is WFH/absent today and not yet reassigned (sorted by label).
 *     This is the key FIFO behaviour: freed permanent spots join the pool for
 *     whoever comes in next after the flex spots run out.
 */
async function autoAssignSpot(employeeId: number, date: string): Promise<number | null> {
  const [emp] = await db
    .select()
    .from(employeesTable)
    .where(eq(employeesTable.id, employeeId));

  // 1. Own permanent spot
  if (emp?.permanentSpotId) {
    return emp.permanentSpotId;
  }

  const takenIds = await getTakenSpotIds(date);

  // 2. Flex spots not taken today
  const flexQuery = takenIds.length
    ? db
        .select()
        .from(parkingSpotsTable)
        .where(
          and(
            eq(parkingSpotsTable.type, "flexible"),
            notInArray(parkingSpotsTable.id, takenIds)
          )
        )
    : db.select().from(parkingSpotsTable).where(eq(parkingSpotsTable.type, "flexible"));

  const flexSpots = await flexQuery;
  flexSpots.sort((a, b) => a.label.localeCompare(b.label));
  if (flexSpots.length > 0) return flexSpots[0].id;

  // 3. Freed permanent spots: owner checked in as WFH today, spot not yet taken
  const wfhRows = await db
    .select({ empId: checkinsTable.employeeId })
    .from(checkinsTable)
    .where(and(eq(checkinsTable.date, date), eq(checkinsTable.status, "wfh")));
  const wfhEmpIds = wfhRows.map((r) => r.empId);

  if (wfhEmpIds.length === 0) return null;

  const permSpots = await db
    .select()
    .from(parkingSpotsTable)
    .where(eq(parkingSpotsTable.type, "permanent"));

  const freedSpots = permSpots
    .filter(
      (s) =>
        s.permanentEmployeeId !== null &&
        wfhEmpIds.includes(s.permanentEmployeeId) &&
        !takenIds.includes(s.id)
    )
    .sort((a, b) => a.label.localeCompare(b.label));

  return freedSpots.length > 0 ? freedSpots[0].id : null;
}

router.get("/checkins", async (req, res): Promise<void> => {
  const query = ListCheckinsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const rows = query.data.date
    ? await db
        .select()
        .from(checkinsTable)
        .where(eq(checkinsTable.date, query.data.date))
        .orderBy(checkinsTable.createdAt)
    : await db.select().from(checkinsTable).orderBy(checkinsTable.createdAt);

  res.json(await Promise.all(rows.map(enrichCheckin)));
});

router.post("/checkins", async (req, res): Promise<void> => {
  const parsed = CreateCheckinBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  // Duplicate check
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
    if (parsed.data.spotId != null) {
      // Manual selection: honour it directly
      spotId = parsed.data.spotId;
    } else {
      // Auto FIFO assignment
      spotId = await autoAssignSpot(parsed.data.employeeId, parsed.data.date);
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
