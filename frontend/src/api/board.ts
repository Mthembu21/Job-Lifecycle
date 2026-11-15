import axios from "axios";
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

/**
 * The TV screen opens the board with its secret link (/board?key=…); a signed-in user's session
 * works without one.
 */
export function useBoardJobs() {
  const key = new URLSearchParams(window.location.search).get("key") ?? undefined;
  return useQuery({
    queryKey: ["board"],
    queryFn: async () => {
      const { data } = await apiClient.get<{ jobs: BoardJob[] }>("/board", { params: { key } });
      return data.jobs;
    },
    refetchInterval: 30_000,
    // A refused key won't start working on a retry.
    retry: (count, error) => !(axios.isAxiosError(error) && error.response?.status === 401) && count < 3,
  });
}
