import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "./client";
import { AuditLogEntry, Job } from "../types";

export interface JobFilters {
  search?: string;
  customer?: string;
  createdById?: string;
  jobType?: string;
  priority?: string;
  createdFrom?: string;
  createdTo?: string;
  stage?: string;
  status?: string;
  missingWo?: string;
}

export function useJobs(filters: JobFilters) {
  return useQuery({
    queryKey: ["jobs", filters],
    queryFn: async () => {
      const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
      const { data } = await apiClient.get<Job[]>("/jobs", { params });
      return data;
    },
  });
}

export function useJob(id: string | undefined) {
  return useQuery({
    queryKey: ["jobs", id],
    queryFn: async () => {
      const { data } = await apiClient.get<Job>(`/jobs/${id}`);
      return data;
    },
    enabled: Boolean(id),
  });
}

export function useJobAudit(id: string | undefined) {
  return useQuery({
    queryKey: ["jobs", id, "audit"],
    queryFn: async () => {
      const { data } = await apiClient.get<AuditLogEntry[]>(`/jobs/${id}/audit`);
      return data;
    },
    enabled: Boolean(id),
  });
}

export interface CreateJobInput {
  referenceNumber: string;
  description: string;
  customer: string;
  serialNumber: string;
  partNumber?: string;
  woNumber?: string;
  poNumber?: string;
  jobType: string;
  poValue: number;
  priority: string;
  jobCreatedDate: string;
  comments?: string;
}

export function useCreateJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateJobInput) => {
      const { data } = await apiClient.post<Job>("/jobs", input);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useUpdateJob(jobId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { woNumber?: string; poNumber?: string; woNumberSetAt?: string }) => {
      const { data } = await apiClient.patch<Job>(`/jobs/${jobId}`, input);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      queryClient.invalidateQueries({ queryKey: ["jobs", jobId] });
      queryClient.invalidateQueries({ queryKey: ["jobs", jobId, "audit"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useDeleteJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (jobId: string) => {
      await apiClient.delete(`/jobs/${jobId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useBulkDeleteJobs() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      const { data } = await apiClient.delete<{ deletedCount: number }>("/jobs", { data: { ids } });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export type StageKey = "quotation" | "repair" | "dispatch" | "invoice";

export function useUpdateStage(jobId: string, stage: StageKey) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: Record<string, unknown>) => {
      const { data } = await apiClient.patch<Job>(`/jobs/${jobId}/${stage}`, input);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      queryClient.invalidateQueries({ queryKey: ["jobs", jobId] });
      queryClient.invalidateQueries({ queryKey: ["jobs", jobId, "audit"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}
