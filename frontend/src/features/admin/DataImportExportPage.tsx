import { useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  List,
  ListItem,
  ListItemText,
  Stack,
  Typography,
} from "@mui/material";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import DownloadIcon from "@mui/icons-material/Download";
import { useAuth } from "../../auth/AuthContext";
import {
  downloadSchedulerExport,
  ImportSummary,
  usePreviewSchedulerImport,
  useRunSchedulerImport,
} from "../../api/importExport";

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

  const canExport = user?.role === "STOREMAN" || user?.role === "PLANNER" || user?.role === "ADMIN";
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

  return (
    <Box sx={{ maxWidth: 720 }}>
      <Typography variant="h5" fontWeight={700} sx={{ mb: 2 }}>
        Tracker Data Import / Export
      </Typography>

      {canImport && (
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 1 }}>
            Import from "SCHEDULER 2025"
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Upload the tracker workbook (.xlsx). Rows whose reference number already exists in the app
            are left untouched — only new jobs are added.
          </Typography>

          <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
            <Button variant="outlined" component="label" startIcon={<UploadFileIcon />}>
              Choose file
              <input ref={fileInputRef} type="file" hidden accept=".xlsx,.xls" onChange={handleFileChange} />
            </Button>
            <Typography variant="body2">{selectedFile?.name ?? "No file selected"}</Typography>
          </Stack>

          <Stack direction="row" spacing={2}>
            <Button variant="outlined" disabled={!selectedFile || previewMutation.isPending} onClick={handlePreview}>
              {previewMutation.isPending ? <CircularProgress size={20} /> : "Preview"}
            </Button>
            <Button
              variant="contained"
              disabled={!selectedFile || importMutation.isPending}
              onClick={handleImport}
            >
              {importMutation.isPending ? <CircularProgress size={20} /> : "Import"}
            </Button>
          </Stack>

          {previewMutation.isError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {(previewMutation.error as any)?.response?.data?.error ?? "Could not read that file"}
            </Alert>
          )}
          {importMutation.isError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {(importMutation.error as any)?.response?.data?.error ?? "Import failed"}
            </Alert>
          )}

          {preview && (
            <Box sx={{ mt: 2 }}>
              <Divider sx={{ mb: 2 }} />
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Preview (nothing has been saved yet)
              </Typography>
              <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                <Chip label={`${preview.totalDataRows} rows in sheet`} />
                <Chip color="success" label={`${preview.created} new jobs to add`} />
                <Chip label={`${preview.skippedExisting} already in app`} />
                {preview.skippedDuplicate > 0 && (
                  <Chip color="warning" label={`${preview.skippedDuplicate} duplicate rows in sheet`} />
                )}
              </Stack>
              <Typography variant="body2" color="text.secondary">
                Click "Import" to add the {preview.created} new jobs to the database.
              </Typography>
            </Box>
          )}

          {imported && (
            <Alert severity="success" sx={{ mt: 2 }}>
              Import complete: {imported.created} new jobs added, {imported.skippedExisting} already
              existed and were left unchanged
              {imported.skippedDuplicate > 0 ? `, ${imported.skippedDuplicate} duplicate rows skipped` : ""}.
            </Alert>
          )}
        </CardContent>
      </Card>
      )}

      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 1 }}>
            Export current data
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Download every job currently in the app as a "SCHEDULER 2025"-format workbook, with the
            same columns as the original tracker.
          </Typography>
          <Button
            variant="contained"
            startIcon={<DownloadIcon />}
            onClick={handleExport}
            disabled={isExporting}
          >
            {isExporting ? <CircularProgress size={20} /> : "Export to Excel"}
          </Button>
          {exportError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {exportError}
            </Alert>
          )}
        </CardContent>
      </Card>

      {preview && preview.rows.some((r) => r.outcome !== "created") && (
        <Card sx={{ mt: 3 }}>
          <CardContent>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Rows skipped in last preview
            </Typography>
            <List dense sx={{ maxHeight: 240, overflow: "auto" }}>
              {preview.rows
                .filter((r) => r.outcome !== "created")
                .map((r) => (
                  <ListItem key={`${r.rowNumber}-${r.referenceNumber}`} disableGutters>
                    <ListItemText
                      primary={`${r.referenceNumber} (sheet row ${r.rowNumber})`}
                      secondary={r.outcome === "skipped_existing" ? "Already in app" : "Duplicate reference in sheet"}
                    />
                  </ListItem>
                ))}
            </List>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}
