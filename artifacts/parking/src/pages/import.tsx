import { useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getListEmployeesQueryKey, getListSpotsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Download, Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Info } from "lucide-react";

type SheetResult = { imported: number; skipped: number; errors: string[] };
type ImportResult = { employees: SheetResult; spots: SheetResult };

export default function ImportPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [dragging, setDragging] = useState(false);

  function pickFile(file: File | null) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      toast({ title: "Invalid file", description: "Please select an .xlsx file", variant: "destructive" });
      return;
    }
    setSelectedFile(file);
    setResult(null);
  }

  async function handleUpload() {
    if (!selectedFile) return;
    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", selectedFile);
      const response = await fetch("/api/import/upload", { method: "POST", body });
      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: "Unknown error" }));
        toast({ title: "Upload failed", description: err.error, variant: "destructive" });
        return;
      }
      const data: ImportResult = await response.json();
      setResult(data);
      // Invalidate list queries so employees/spots pages refresh
      queryClient.invalidateQueries({ queryKey: getListEmployeesQueryKey() });
      queryClient.invalidateQueries({ queryKey: getListSpotsQueryKey() });
      const totalImported = data.employees.imported + data.spots.imported;
      const totalErrors = data.employees.errors.length + data.spots.errors.length;
      if (totalErrors === 0) {
        toast({ title: "Import complete", description: `${totalImported} records imported successfully` });
      } else {
        toast({
          title: "Import completed with warnings",
          description: `${totalImported} imported, ${totalErrors} issue(s) — see details below`,
          variant: "destructive",
        });
      }
    } catch {
      toast({ title: "Upload failed", description: "Network error — is the server running?", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Import Data</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Bulk-import employees and parking spots from a single Excel file.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* ---- Step 1: Download template ---- */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">1</span>
              Download Template
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Start with the official template. It has two pre-formatted sheets with example rows and a dropdown for spot type.
            </p>
            <div className="rounded-md border bg-muted/40 p-3 space-y-1.5 text-sm">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4 text-blue-500 flex-shrink-0" />
                <span><strong>Employees</strong> — Name*, Email*, Phone, Department, Permanent Spot Label</span>
              </div>
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4 text-green-600 flex-shrink-0" />
                <span><strong>Parking Spots</strong> — Label*, Type* (permanent/flexible), Zone, Permanent Employee Email</span>
              </div>
            </div>
            <div className="flex items-start gap-2 text-xs text-muted-foreground">
              <Info className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
              <span>Fields marked <strong>*</strong> are required. Spots are imported first so employee permanent-spot links resolve correctly.</span>
            </div>
            <a href="/api/import/template" download="parkdesk-import-template.xlsx">
              <Button className="w-full" variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Download Template (.xlsx)
              </Button>
            </a>
          </CardContent>
        </Card>

        {/* ---- Step 2: Upload ---- */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">2</span>
              Upload Filled Template
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Drop zone */}
            <div
              className={`relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center transition-colors cursor-pointer
                ${dragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30"}
              `}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                pickFile(e.dataTransfer.files[0] ?? null);
              }}
            >
              <FileSpreadsheet className="h-10 w-10 mb-3 text-muted-foreground" />
              {selectedFile ? (
                <>
                  <p className="text-sm font-medium">{selectedFile.name}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {(selectedFile.size / 1024).toFixed(1)} KB — click to change
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium">Drop your .xlsx file here</p>
                  <p className="text-xs text-muted-foreground mt-1">or click to browse</p>
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="hidden"
                onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
              />
            </div>

            <Button
              className="w-full"
              disabled={!selectedFile || uploading}
              onClick={handleUpload}
            >
              <Upload className="h-4 w-4 mr-2" />
              {uploading ? "Importing…" : "Import Data"}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* ---- Results ---- */}
      {result && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Import Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <ResultSection title="Employees" icon="👤" result={result.employees} />
              <ResultSection title="Parking Spots" icon="🅿️" result={result.spots} />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ResultSection({ title, icon, result }: { title: string; icon: string; result: SheetResult }) {
  return (
    <div className="space-y-3">
      <h3 className="font-medium flex items-center gap-1.5">
        <span>{icon}</span> {title}
      </h3>
      <div className="flex flex-wrap gap-2">
        <Badge variant="outline" className="gap-1.5 text-green-700 border-green-200 bg-green-50">
          <CheckCircle2 className="h-3.5 w-3.5" />
          {result.imported} imported
        </Badge>
        {result.skipped > 0 && (
          <Badge variant="outline" className="gap-1.5 text-amber-700 border-amber-200 bg-amber-50">
            <AlertCircle className="h-3.5 w-3.5" />
            {result.skipped} skipped
          </Badge>
        )}
      </div>
      {result.errors.length > 0 && (
        <ul className="space-y-1 rounded-md border border-destructive/30 bg-destructive/5 p-3">
          {result.errors.map((e, i) => (
            <li key={i} className="text-xs text-destructive flex items-start gap-1.5">
              <span className="mt-0.5">•</span>
              <span>{e}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
