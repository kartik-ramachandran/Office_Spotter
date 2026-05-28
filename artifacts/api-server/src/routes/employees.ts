import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, employeesTable, parkingSpotsTable } from "@workspace/db";
import {
  CreateEmployeeBody,
  UpdateEmployeeParams,
  UpdateEmployeeBody,
  DeleteEmployeeParams,
  GetEmployeeParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

async function enrichEmployee(emp: typeof employeesTable.$inferSelect) {
  let permanentSpotLabel: string | null = null;
  if (emp.permanentSpotId) {
    const [spot] = await db
      .select()
      .from(parkingSpotsTable)
      .where(eq(parkingSpotsTable.id, emp.permanentSpotId));
    permanentSpotLabel = spot?.label ?? null;
  }
  return {
    id: emp.id,
    name: emp.name,
    email: emp.email,
    phone: emp.phone ?? null,
    department: emp.department ?? null,
    permanentSpotId: emp.permanentSpotId ?? null,
    permanentSpotLabel,
  };
}

router.get("/employees", async (_req, res): Promise<void> => {
  const employees = await db.select().from(employeesTable).orderBy(employeesTable.name);
  const enriched = await Promise.all(employees.map(enrichEmployee));
  res.json(enriched);
});

router.post("/employees", async (req, res): Promise<void> => {
  const parsed = CreateEmployeeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [emp] = await db.insert(employeesTable).values(parsed.data).returning();
  res.status(201).json(await enrichEmployee(emp));
});

router.get("/employees/:id", async (req, res): Promise<void> => {
  const params = GetEmployeeParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [emp] = await db.select().from(employeesTable).where(eq(employeesTable.id, params.data.id));
  if (!emp) {
    res.status(404).json({ error: "Employee not found" });
    return;
  }
  res.json(await enrichEmployee(emp));
});

router.patch("/employees/:id", async (req, res): Promise<void> => {
  const params = UpdateEmployeeParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateEmployeeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [emp] = await db
    .update(employeesTable)
    .set(parsed.data)
    .where(eq(employeesTable.id, params.data.id))
    .returning();
  if (!emp) {
    res.status(404).json({ error: "Employee not found" });
    return;
  }
  res.json(await enrichEmployee(emp));
});

router.delete("/employees/:id", async (req, res): Promise<void> => {
  const params = DeleteEmployeeParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [emp] = await db
    .delete(employeesTable)
    .where(eq(employeesTable.id, params.data.id))
    .returning();
  if (!emp) {
    res.status(404).json({ error: "Employee not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
