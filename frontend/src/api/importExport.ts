import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "./client";

export interface ImportRowResult {
  referenceNumber: string;
  rowNumber: number;
  outcome: "created" | "skipped_existing" | "skipped_duplicate";
}

export interface ImportSummary {
  totalDataRows: number;
  created: number;
  skippedExisting: number;
  skippedDuplicate: number;
  rows: ImportRowResult[];
}

export function usePreviewSchedulerImport() {
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const { data } = await apiClient.post<ImportSummary>("/import-export/scheduler/preview", formData);
      return data;
    },
  });
}

export function useRunSchedulerImport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const { data } = await apiClient.post<ImportSummary>("/import-export/scheduler", formData);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export async function downloadSchedulerExport() {
  const response = await apiClient.get("/import-export/scheduler/export", { responseType: "blob" });
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", `Epiroc-Job-Tracker-${new Date().toISOString().slice(0, 10)}.xlsx`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}
