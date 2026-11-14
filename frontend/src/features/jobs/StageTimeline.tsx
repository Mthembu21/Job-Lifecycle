import { Check, Pencil, Trash2 } from "lucide-react";
import { Job, StageName } from "../../types";
import { SlaChip } from "../common/SlaChip";
import { StageStatusChip } from "../common/StageStatusChip";
import { formatDate } from "../../utils/date";
import { JOB_TYPE_LABELS, ROLE_LABELS } from "../../constants";
import { isNonInvoicedJobType } from "../../utils/jobTypes";
import { useAuth } from "../../auth/AuthContext";
import { canEditStage } from "../../auth/permissions";
import { StageKey } from "../../api/jobs";
import { IconButton, cn } from "../../components/ui";

interface StepDef {
  key: StageName;
  label: string;
  editStage?: StageKey;
  hasData?: boolean;
  completedDate: string | null | undefined;
  responsible: string | null | undefined;
  comments: string | null | undefined;
  delayReason: string | null | undefined;
}

export function StageTimeline({
  job,
  onEdit,
  onDelete,
}: {
  job: Job;
  onEdit: (stage: StageKey) => void;
  onDelete: (stage: StageKey) => void;
}) {
  const { user } = useAuth();

  const steps: StepDef[] = [
    {
      key: "QUOTATION" as StageName,
      label: "Job Created",
      completedDate: job.jobCreatedDate,
      responsible: job.createdBy?.name ?? null,
      comments: job.comments,
      delayReason: null,
    },
    {
      key: "QUOTATION",
      label: "Quotation",
      editStage: "quotation",
      hasData: Boolean(job.quotation),
      completedDate: job.quotation?.epirocQuotationDate,
      responsible: job.quotation?.quotedBy?.name ?? null,
      comments: job.quotation?.comments,
      delayReason: job.quotation?.delayReason,
    },
    {
      key: "REPAIR",
      label: "Repair",
      editStage: "repair",
      hasData: Boolean(job.repair),
      completedDate: job.repair?.repairCompletionDate,
      responsible: job.repair?.technicianName || null,
      comments: job.repair?.comments,
      delayReason: job.repair?.delayReason,
    },
    {
      key: "DISPATCH",
      label: "Dispatch",
      editStage: "dispatch",
      hasData: Boolean(job.dispatch),
      completedDate: job.dispatch?.dispatchDate,
      responsible: job.dispatch?.dispatchedBy?.name ?? null,
      comments: job.dispatch?.comments,
      delayReason: job.dispatch?.delayReason,
    },
    {
      key: "INVOICING",
      label: isNonInvoicedJobType(job.jobType) ? "Close Job (no invoice)" : "Invoice",
      editStage: "invoice",
      hasData: Boolean(job.invoice),
      completedDate: job.invoice?.invoiceDate ?? (job.status.closedWithoutInvoice ? job.invoice?.closingDate : null),
      responsible: job.status.closedWithoutInvoice
        ? `Closed without invoice (${JOB_TYPE_LABELS[job.jobType]})`
        : job.invoice?.invoiceNumber
          ? ROLE_LABELS.PLANNER
          : null,
      comments: job.invoice?.comments,
      delayReason: job.invoice?.delayReason,
    },
    {
      key: "CLOSED",
      label: "Closed",
      completedDate: job.invoice?.closingDate,
      responsible: null,
      comments: null,
      delayReason: null,
    },
  ];

  // AWAITING_PO has no dedicated visual step here — it's shown inside "Repair" — so
  // treat it as REPAIR when locating which step should be highlighted as active.
  const effectiveStage = job.status.currentStage === "AWAITING_PO" ? "REPAIR" : job.status.currentStage;
  const activeIndex = job.status.isClosed
    ? steps.length - 1
    : Math.max(
        1,
        steps.findIndex((s, idx) => idx > 0 && s.key === effectiveStage)
      );

  const slaByStage = Object.fromEntries(job.status.stages.map((s) => [s.name, s]));

  return (
    <ol className="relative">
      {steps.map((step, idx) => {
        const computed = idx > 0 && idx < steps.length - 1 ? slaByStage[step.key] : undefined;
        const isLast = idx === steps.length - 1;
        const isCompleted = idx === 0 || Boolean(step.completedDate) || (isLast && job.status.isClosed);
        const isActive = idx === activeIndex && !(isLast && job.status.isClosed);
        const canEdit = step.editStage && canEditStage(user?.role, step.editStage);

        return (
          <li key={`${step.key}-${idx}`} className="relative flex gap-4 pb-6 last:pb-0">
            {!isLast && (
              <span
                aria-hidden
                className={cn(
                  "absolute top-8 bottom-0 left-[15px] w-0.5",
                  isCompleted ? "bg-yellow" : "bg-gray-200 dark:bg-gray-700"
                )}
              />
            )}
            <span
              className={cn(
                "relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold",
                isCompleted && "bg-yellow text-gray-900",
                !isCompleted && isActive && "border-2 border-yellow bg-white text-gray-900 ring-4 ring-yellow/25 dark:bg-gray-900 dark:text-yellow",
                !isCompleted && !isActive && "border-2 border-gray-300 bg-white text-gray-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-400"
              )}
            >
              {isCompleted ? <Check className="size-4" strokeWidth={3} /> : idx + 1}
            </span>

            <div
              className={cn(
                "min-w-0 flex-1 rounded-lg pt-1",
                isActive && "-mt-1 bg-gray-50 px-3 py-2 dark:bg-gray-800/60"
              )}
            >
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold text-gray-900 dark:text-gray-50">{step.label}</h3>
                {computed && <StageStatusChip status={computed.status} />}
                {isLast && job.status.isClosed && <StageStatusChip status="CLOSED" />}
                {canEdit && (
                  <span className="ml-auto flex">
                    <IconButton size="sm" label={`Edit ${step.label}`} onClick={() => onEdit(step.editStage!)}>
                      <Pencil />
                    </IconButton>
                    {step.hasData && (
                      <IconButton size="sm" tone="danger" label={`Delete ${step.label}`} onClick={() => onDelete(step.editStage!)}>
                        <Trash2 />
                      </IconButton>
                    )}
                  </span>
                )}
              </div>
              <div className="mt-1 space-y-1 text-sm">
                <p className="text-gray-600 dark:text-gray-400">
                  Date: {formatDate(step.completedDate)}
                  {step.responsible ? ` · ${step.responsible}` : ""}
                </p>
                {computed && (
                  <div className="flex flex-wrap items-center gap-2">
                    <SlaChip status={computed.sla.status} />
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {computed.sla.days !== null
                        ? `${computed.sla.days} of ${computed.sla.target} target days`
                        : "Not yet applicable"}
                    </span>
                  </div>
                )}
                {step.comments && <p className="text-gray-800 dark:text-gray-200">Comments: {step.comments}</p>}
                {step.delayReason && (
                  <p className="text-danger dark:text-danger-light">Delay reason: {step.delayReason}</p>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
