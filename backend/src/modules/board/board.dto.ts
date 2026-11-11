import { Prisma } from "@prisma/client";
import { jobListInclude } from "../jobs/jobs.dto";
import { deriveJobStatus, StageComputed } from "../../lib/statusEngine";

type JobWithListRelations = Prisma.JobGetPayload<{ include: typeof jobListInclude }>;

export interface BoardStage {
  name: StageComputed["name"];
  status: StageComputed["status"];
  slaStatus: StageComputed["sla"]["status"];
}

/**
 * Allowlist DTO for the public TV board — hand-picks only the fields a
 * meeting-room screen needs. Never spread a job/quotation/repair/invoice
 * object here: this is the one unauthenticated endpoint in the app, so a
 * future money field added to the schema must not leak through it by
 * accident.
 */
export function toBoardJobDto(job: JobWithListRelations) {
  const derived = deriveJobStatus(job);
  return {
    id: job.id,
    referenceNumber: job.referenceNumber,
    customer: job.customer,
    description: job.description,
    jobType: job.jobType,
    priority: job.priority,
    technicianName: job.repair?.technicianName ?? null,
    jobCreatedDate: job.jobCreatedDate,
    currentStage: derived.currentStage,
    currentStatus: derived.currentStatus,
    slaCompliant: derived.slaCompliant,
    isClosed: derived.isClosed,
    stages: derived.stages.map(
      (s): BoardStage => ({ name: s.name, status: s.status, slaStatus: s.sla.status })
    ),
  };
}

export type BoardJobDto = ReturnType<typeof toBoardJobDto>;
