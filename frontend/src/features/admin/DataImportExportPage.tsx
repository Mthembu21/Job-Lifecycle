import { useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { Download, FileSpreadsheet, Upload } from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import { canUseDataImportExport } from "../../auth/permissions";
import {
  downloadSchedulerExport,
  ImportSummary,
  usePreviewSchedulerImport,
  useRunSchedulerImport,
} from "../../api/importExport";
import { Alert, Badge, Button, Card, CardTitle, PageHeader } from "../../components/ui";
import { apiErrorMessage } from "../../api/client";

export function DataImportExportPage() {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportSummary | null>(null);
  const [imported, setImported] = useState<ImportSummary | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const previewMutation = usePreviewSchedulerImport();
  const importMutation = useRunSchedulerImport();

  const canExport = canUseDataImportExport(user?.role);
  const canImport = user?.role === "ADMIN";

  if (!canExport) {
    return <Navigate to="/" replace />;
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setSelectedFile(file);
    setPreview(null);
    setImported(null);
  }

  function handlePreview() {
    if (!selectedFile) return;
    previewMutation.mutate(selectedFile, {
      onSuccess: (summary) => setPreview(summary),
    });
  }

  function handleImport() {
    if (!selectedFile) return;
    importMutation.mutate(selectedFile, {
      onSuccess: (summary) => {
        setImported(summary);
        setPreview(null);
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
      },
    });
  }

  async function handleExport() {
    setIsExporting(true);
    setExportError(null);
    try {
      await downloadSchedulerExport();
    } catch {
      setExportError("Export failed. Please try again.");
    } finally {
      setIsExporting(false);
    }
  }

  const skippedRows = preview?.rows.filter((r) => r.outcome !== "created") ?? [];
  const warningRows = preview?.rows.filter((r) => r.outcome === "created" && r.warnings) ?? [];
  const skipReason: Record<string, string> = {
    skipped_existing: "Already in app",
    skipped_duplicate: "Duplicate reference in sheet",
    skipped_no_job_opening: "No Job Opening or Date Received — add one in the sheet and import again",
  };

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <PageHeader title="Tracker Data Import / Export" />

      {canImport && (
        <Card className="p-6">
          <CardTitle>Import from "SCHEDULER 2025"</CardTitle>
          <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
            Upload the tracker workbook (.xlsx). Rows whose reference number already exists in the app are left
            untouched — only new jobs are added.
          </p>

          <label className="mb-4 flex cursor-pointer items-center gap-3 rounded-lg border-2 border-dashed border-gray-300 px-4 py-4 transition-colors hover:border-yellow hover:bg-yellow-soft/50 dark:border-gray-600 dark:hover:bg-yellow/5">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800">
              <FileSpreadsheet className="size-5 text-gray-600 dark:text-gray-300" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
                {selectedFile?.name ?? "Choose a workbook…"}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">.xlsx or .xls</span>
            </span>
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-700 dark:text-gray-200">
              <Upload className="size-4" /> Browse
            </span>
            <input ref={fileInputRef} type="file" className="sr-only" accept=".xlsx,.xls" onChange={handleFileChange} />
          </label>

          <div className="flex gap-2">
            <Button disabled={!selectedFile} loading={previewMutation.isPending} onClick={handlePreview}>
              Preview
            </Button>
            <Button variant="primary" disabled={!selectedFile} loading={importMutation.isPending} onClick={handleImport}>
              Import
            </Button>
          </div>

          {previewMutation.isError && (
            <Alert severity="error" className="mt-4">
              {apiErrorMessage(previewMutation.error, "Could not read that file")}
            </Alert>
          )}
          {importMutation.isError && (
            <Alert severity="error" className="mt-4">
              {apiErrorMessage(importMutation.error, "Import failed")}
            </Alert>
          )}

          {preview && (
            <div className="mt-5 border-t border-gray-100 pt-4 dark:border-gray-800">
              <p className="mb-2 text-sm font-semibold">Preview (nothing has been saved yet)</p>
              <div className="mb-2 flex flex-wrap gap-2">
                <Badge>{preview.totalDataRows} rows in sheet</Badge>
                <Badge tone="success">{preview.created} new jobs to add</Badge>
                <Badge>{preview.skippedExisting} already in app</Badge>
                {preview.skippedDuplicate > 0 && <Badge tone="warning">{preview.skippedDuplicate} duplicate rows in sheet</Badge>}
                {preview.skippedNoJobOpening > 0 && (
                  <Badge tone="warning">{preview.skippedNoJobOpening} skipped — no Job Opening</Badge>
                )}
                {preview.withWarnings > 0 && <Badge tone="warning">{preview.withWarnings} with dates to check</Badge>}
              </div>
              {preview.newCustomers.length > 0 && (
                <p className="mb-2 text-sm text-gray-600 dark:text-gray-400">
                  New customers that will be added to the customer list: <strong>{preview.newCustomers.join(", ")}</strong>. If
                  one of these is an existing customer spelt differently, correct the sheet first (or rename it on the
                  Customers page afterwards).
                </p>
              )}
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Click "Import" to add the {preview.created} new jobs to the database.
              </p>
            </div>
          )}

          {imported && (
            <Alert severity="success" className="mt-4">
              Import complete: {imported.created} new jobs added, {imported.skippedExisting} already existed and were left
              unchanged
              {imported.skippedDuplicate > 0 ? `, ${imported.skippedDuplicate} duplicate rows skipped` : ""}
              {imported.skippedNoJobOpening > 0 ? `, ${imported.skippedNoJobOpening} skipped for having no Job Opening` : ""}.
              {imported.withWarnings > 0 && ` ${imported.withWarnings} imported jobs have dates to check — see the list below.`}
            </Alert>
          )}
        </Card>
      )}

      <Card className="p-6">
        <CardTitle>Export current data</CardTitle>
        <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
          Download every job currently in the app as a "SCHEDULER 2025"-format workbook, with the same columns as the
          original tracker.
        </p>
        <Button variant="primary" icon={<Download className="size-4" />} onClick={handleExport} loading={isExporting}>
          Export to Excel
        </Button>
        {exportError && (
          <Alert severity="error" className="mt-4">
            {exportError}
          </Alert>
        )}
      </Card>

      {skippedRows.length > 0 && (
        <Card className="p-6">
          <CardTitle>Rows skipped in last preview</CardTitle>
          <ul className="max-h-60 divide-y divide-gray-100 overflow-auto dark:divide-gray-800">
            {skippedRows.map((r) => (
              <li key={`${r.rowNumber}-${r.referenceNumber}`} className="py-2">
                <p className="text-sm font-medium">
                  {r.referenceNumber} (sheet row {r.rowNumber})
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{skipReason[r.outcome]}</p>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {warningRows.length > 0 && (
        <Card className="p-6">
          <CardTitle>Dates to check after importing</CardTitle>
          <p className="mb-2 text-sm text-gray-600 dark:text-gray-400">
            These rows are imported as they are in the sheet, but their dates break the job flow. Correct them on the job
            page afterwards so the dashboard reads them correctly.
          </p>
          <ul className="max-h-80 divide-y divide-gray-100 overflow-auto dark:divide-gray-800">
            {warningRows.map((r) => (
              <li key={`${r.rowNumber}-${r.referenceNumber}`} className="py-2">
                <p className="text-sm font-medium">
                  {r.referenceNumber} (sheet row {r.rowNumber})
                </p>
                <ul className="list-disc pl-5 text-xs text-gray-500 dark:text-gray-400">
                  {r.warnings!.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
