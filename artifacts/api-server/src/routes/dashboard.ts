import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, checkinsTable, parkingSpotsTable, employeesTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/dashboard", async (_req, res): Promise<void> => {
  const today = new Date().toISOString().split("T")[0];

  const [allSpots, todayCheckins] = await Promise.all([
    db.select().from(parkingSpotsTable),
    db.select().from(checkinsTable).where(eq(checkinsTable.date, today)),
  ]);

  const inOfficeCheckins = todayCheckins.filter((c) => c.status === "in_office");
  const wfhCheckins = todayCheckins.filter((c) => c.status === "wfh");
  const occupiedSpotIds = new Set(
    inOfficeCheckins.map((c) => c.spotId).filter((id): id is number => id !== null)
  );

  const totalSpots = allSpots.length;
  const spotsOccupied = occupiedSpotIds.size;
  const spotsAvailable = totalSpots - spotsOccupied;
  const permanentSpots = allSpots.filter((s) => s.type === "permanent").length;
  const flexibleSpots = allSpots.filter((s) => s.type === "flexible").length;

  // Enrich checkins with employee name and spot label
  const enrichedCheckins = await Promise.all(
    todayCheckins.map(async (checkin) => {
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
    })
  );

  res.json({
    date: today,
    totalSpots,
    spotsAvailable,
    spotsOccupied,
    permanentSpots,
    flexibleSpots,
    inOfficeCount: inOfficeCheckins.length,
    wfhCount: wfhCheckins.length,
    checkins: enrichedCheckins,
  });
});

export default router;
