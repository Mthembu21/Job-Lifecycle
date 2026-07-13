import { Prisma } from "@prisma/client";
import { deriveJobStatus } from "../../lib/statusEngine";

type JobWithListRelations = Prisma.JobGetPayload<{ include: typeof jobListInclude }>;

export function toJobDto(job: JobWithListRelations) {
  const derived = deriveJobStatus(job);
  return {
    id: job.id,
    referenceNumber: job.referenceNumber,
    description: job.description,
    customer: job.customer,
    serialNumber: job.serialNumber,
    partNumber: job.partNumber,
    woNumber: job.woNumber,
    woNumberSetAt: job.woNumberSetAt,
    poNumber: job.poNumber,
    jobType: job.jobType,
    poValue: job.poValue,
    priority: job.priority,
    jobCreatedDate: job.jobCreatedDate,
    comments: job.comments,
    createdBy: job.createdBy ? { id: job.createdBy.id, name: job.createdBy.name } : null,
    quotation: job.quotation
      ? { ...job.quotation, quotedBy: job.quotation.quotedBy ? namePick(job.quotation.quotedBy) : null }
      : null,
    repair: job.repair,
    dispatch: job.dispatch
      ? { ...job.dispatch, dispatchedBy: job.dispatch.dispatchedBy ? namePick(job.dispatch.dispatchedBy) : null }
      : null,
    invoice: job.invoice,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    status: derived,
  };
}

function namePick(user: { id: string; name: string }) {
  return { id: user.id, name: user.name };
}

export type JobDto = ReturnType<typeof toJobDto>;

export const jobListInclude = {
  createdBy: { select: { id: true, name: true } },
  quotation: { include: { quotedBy: { select: { id: true, name: true } } } },
  repair: true,
  dispatch: { include: { dispatchedBy: { select: { id: true, name: true } } } },
  invoice: true,
} as const;
