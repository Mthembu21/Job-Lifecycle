import { useQuery } from "@tanstack/react-query";
import { apiClient } from "./client";
import { JobType, Priority, SlaColor, StageName, StageStatus } from "../types";

export interface BoardStage {
  name: Exclude<StageName, "CLOSED">;
  status: StageStatus;
  slaStatus: SlaColor;
}

export interface BoardJob {
  id: string;
  referenceNumber: string;
  customer: string;
  description: string;
  jobType: JobType;
  priority: Priority;
  technicianName: string | null;
  jobCreatedDate: string;
  currentStage: StageName;
  currentStatus: StageStatus | "CLOSED";
  slaCompliant: boolean;
  isClosed: boolean;
  stages: BoardStage[];
}

export function useBoardJobs() {
  return useQuery({
    queryKey: ["board"],
    queryFn: async () => {
      const { data } = await apiClient.get<{ jobs: BoardJob[] }>("/board");
      return data.jobs;
    },
    refetchInterval: 30_000,
  });
}
