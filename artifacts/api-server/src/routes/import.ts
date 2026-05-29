import { Router, type IRouter } from "express";
import multer from "multer";
import ExcelJS from "exceljs";
import { db, employeesTable, parkingSpotsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    if (
      file.mimetype === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      file.originalname.toLowerCase().endsWith(".xlsx")
    ) {
      cb(null, true);
    } else {
      cb(new Error("Only .xlsx files are accepted"));
    }
  },
});

// ---------------------------------------------------------------------------
// GET /import/template — download a styled Excel template
// ---------------------------------------------------------------------------
router.get("/import/template", async (_req, res): Promise<void> => {
  const wb = new ExcelJS.Workbook();
  wb.creator = "ParkDesk";

  // ---- Employees sheet ----
  const empSheet = wb.addWorksheet("Employees");
  empSheet.columns = [
    { header: "Name *", key: "name", width: 26 },
    { header: "Email *", key: "email", width: 32 },
    { header: "Phone", key: "phone", width: 18 },
    { header: "Department", key: "department", width: 22 },
    { header: "Permanent Spot Label", key: "permanentSpotLabel", width: 24 },
  ];
  const empHeader = empSheet.getRow(1);
  empHeader.font = { bold: true, color: { argb: "FF1D4273" } };
  empHeader.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9E1F2" } };
  empHeader.height = 20;
  empSheet.views = [{ state: "frozen", xSplit: 0, ySplit: 1 }];
  // Example rows
  empSheet.addRow(["Jane Smith", "jane.smith@example.com", "555-1234", "Engineering", "A01"]);
  empSheet.addRow(["John Doe", "john.doe@example.com", "555-5678", "Marketing", ""]);

  // ---- Parking Spots sheet ----
  const spotsSheet = wb.addWorksheet("Parking Spots");
  spotsSheet.columns = [
    { header: "Label *", key: "label", width: 14 },
    { header: "Type *", key: "type", width: 16 },
    { header: "Zone", key: "zone", width: 14 },
    { header: "Permanent Employee Email", key: "permanentEmployeeEmail", width: 32 },
  ];
  const spotsHeader = spotsSheet.getRow(1);
  spotsHeader.font = { bold: true, color: { argb: "FF1D5C3A" } };
  spotsHeader.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2EFDA" } };
  spotsHeader.height = 20;
  spotsSheet.views = [{ state: "frozen", xSplit: 0, ySplit: 1 }];
  // Dropdown for Type column rows 2-200
  for (let row = 2; row <= 200; row++) {
    spotsSheet.getCell(`B${row}`).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: ['"permanent,flexible"'],
      showErrorMessage: true,
      errorTitle: "Invalid type",
      error: 'Please enter "permanent" or "flexible"',
    };
  }
  // Example rows
  spotsSheet.addRow(["A01", "permanent", "North", "jane.smith@example.com"]);
  spotsSheet.addRow(["B01", "flexible", "South", ""]);
  spotsSheet.addRow(["B02", "flexible", "South", ""]);

  const buffer = await wb.xlsx.writeBuffer();
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
  res.setHeader(
    "Content-Disposition",
    'attachment; filename="parkdesk-import-template.xlsx"',
  );
  res.send(Buffer.from(buffer));
});

// ---------------------------------------------------------------------------
// POST /import/upload — parse uploaded .xlsx and bulk-insert records
// ---------------------------------------------------------------------------
router.post(
  "/import/upload",
  upload.single("file"),
  async (req, res): Promise<void> => {
    if (!req.file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }

    const wb = new ExcelJS.Workbook();
    // exceljs types predate Node 24's Buffer<ArrayBufferLike> generic
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await wb.xlsx.load(req.file.buffer as any);

    const results = {
      employees: { imported: 0, skipped: 0, errors: [] as string[] },
      spots: { imported: 0, skipped: 0, errors: [] as string[] },
    };

    // ------------------------------------------------------------------
    // 1. Collect spot rows from sheet
    // ------------------------------------------------------------------
    type SpotRow = {
      label: string;
      type: string;
      zone: string | null;
      permanentEmployeeEmail: string;
    };
    const spotRows: SpotRow[] = [];
    const spotsSheet = wb.getWorksheet("Parking Spots");
    if (spotsSheet) {
      spotsSheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const label = String(row.getCell(1).value ?? "").trim();
        if (!label) return;
        spotRows.push({
          label,
          type: String(row.getCell(2).value ?? "flexible").trim().toLowerCase(),
          zone: String(row.getCell(3).value ?? "").trim() || null,
          permanentEmployeeEmail: String(row.getCell(4).value ?? "")
            .trim()
            .toLowerCase(),
        });
      });
    }

    // ------------------------------------------------------------------
    // 2. Insert spots, build label → id map
    // ------------------------------------------------------------------
    const spotLabelToId = new Map<string, number>();
    for (const [i, r] of spotRows.entries()) {
      const spotType = r.type === "permanent" ? "permanent" : "flexible";
      try {
        const [spot] = await db
          .insert(parkingSpotsTable)
          .values({ label: r.label, type: spotType, zone: r.zone })
          .returning();
        spotLabelToId.set(r.label, spot.id);
        results.spots.imported++;
      } catch {
        results.spots.errors.push(
          `Row ${i + 2}: could not insert spot "${r.label}" (may already exist)`,
        );
        results.spots.skipped++;
      }
    }

    // ------------------------------------------------------------------
    // 3. Collect employee rows from sheet
    // ------------------------------------------------------------------
    type EmpRow = {
      name: string;
      email: string;
      phone: string | null;
      department: string | null;
      permanentSpotLabel: string;
    };
    const empRows: EmpRow[] = [];
    const empSheet = wb.getWorksheet("Employees");
    if (empSheet) {
      empSheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const name = String(row.getCell(1).value ?? "").trim();
        const email = String(row.getCell(2).value ?? "").trim().toLowerCase();
        if (!name || !email) return;
        empRows.push({
          name,
          email,
          phone: String(row.getCell(3).value ?? "").trim() || null,
          department: String(row.getCell(4).value ?? "").trim() || null,
          permanentSpotLabel: String(row.getCell(5).value ?? "").trim(),
        });
      });
    }

    // ------------------------------------------------------------------
    // 4. Insert employees, resolving permanent spot by label
    // ------------------------------------------------------------------
    const emailToId = new Map<string, number>();
    for (const [i, r] of empRows.entries()) {
      let permanentSpotId: number | null = null;
      if (r.permanentSpotLabel) {
        if (spotLabelToId.has(r.permanentSpotLabel)) {
          permanentSpotId = spotLabelToId.get(r.permanentSpotLabel)!;
        } else {
          // Spot may already exist in DB from a previous import
          const [existing] = await db
            .select({ id: parkingSpotsTable.id })
            .from(parkingSpotsTable)
            .where(eq(parkingSpotsTable.label, r.permanentSpotLabel));
          permanentSpotId = existing?.id ?? null;
        }
      }
      try {
        const [emp] = await db
          .insert(employeesTable)
          .values({
            name: r.name,
            email: r.email,
            phone: r.phone,
            department: r.department,
            permanentSpotId,
          })
          .returning();
        emailToId.set(r.email, emp.id);
        results.employees.imported++;
      } catch {
        results.employees.errors.push(
          `Row ${i + 2}: could not insert employee "${r.email}" (may already exist)`,
        );
        results.employees.skipped++;
      }
    }

    // ------------------------------------------------------------------
    // 5. Back-fill spot → employee link using permanentEmployeeEmail column
    // ------------------------------------------------------------------
    for (const r of spotRows) {
      if (!r.permanentEmployeeEmail) continue;
      const spotId = spotLabelToId.get(r.label);
      if (!spotId) continue;

      const empId =
        emailToId.get(r.permanentEmployeeEmail) ??
        (await db
          .select({ id: employeesTable.id })
          .from(employeesTable)
          .where(eq(employeesTable.email, r.permanentEmployeeEmail))
          .then(([row]) => row?.id ?? null));

      if (!empId) continue;

      await db
        .update(parkingSpotsTable)
        .set({ permanentEmployeeId: empId })
        .where(eq(parkingSpotsTable.id, spotId));

      // Ensure employee also points back to the spot
      await db
        .update(employeesTable)
        .set({ permanentSpotId: spotId })
        .where(eq(employeesTable.id, empId));
    }

    res.json(results);
  },
);

export default router;
