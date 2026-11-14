import { Job, SlaResult } from "../types";

/** The SLA of the stage the job is currently in (null once it's closed). */
export function currentStageSla(job: Job): SlaResult | null {
  if (job.status.isClosed) return null;
  return job.status.stages.find((s) => s.name === job.status.currentStage)?.sla ?? null;
}
