import { BoardJob } from "../../api/board";
import { PRIORITY_LABELS, STAGE_STATUS_LABELS } from "../../constants";
import { SlaColor } from "../../types";

// Literal class names, not string-interpolated — Tailwind's scanner only
// picks up class strings it can find written out in the source.
const SLA_STYLE: Record<SlaColor, { border: string; pill: string; label: string }> = {
  GREEN: { border: "border-l-success", pill: "bg-success-soft text-success", label: "On track" },
  AMBER: { border: "border-l-yellow", pill: "bg-yellow text-gray-900", label: "Approaching SLA" },
  RED: { border: "border-l-danger", pill: "bg-danger-soft text-danger", label: "Overdue" },
  NOT_APPLICABLE: { border: "border-l-gray-300", pill: "bg-gray-100 text-gray-600", label: "—" },
};

const PRIORITY_CLASS: Record<BoardJob["priority"], string> = {
  HIGH: "bg-danger text-white",
  MEDIUM: "bg-gray-100 text-gray-700",
  LOW: "bg-gray-100 text-gray-500",
};

export function BoardJobCard({ job }: { job: BoardJob }) {
  const currentStageInfo = job.stages.find((s) => s.name === job.currentStage);
  const sla = SLA_STYLE[job.isClosed ? "GREEN" : currentStageInfo?.slaStatus ?? "NOT_APPLICABLE"];

  return (
    <div className={`flex flex-col gap-1.5 rounded-xl border border-l-[6px] border-gray-200 bg-white p-4 shadow-sm ${sla.border}`}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="truncate text-xl font-bold text-gray-900">{job.referenceNumber}</h3>
        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-wide uppercase ${PRIORITY_CLASS[job.priority]}`}>
          {PRIORITY_LABELS[job.priority]}
        </span>
      </div>
      <p className="truncate text-base font-medium text-gray-800">{job.customer}</p>
      <p className="truncate text-sm text-gray-500">{job.description}</p>
      <div className="mt-2 flex items-center justify-between gap-2 border-t border-gray-100 pt-2.5">
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${sla.pill}`}>
          {job.isClosed ? STAGE_STATUS_LABELS.CLOSED : `${STAGE_STATUS_LABELS[job.currentStatus]} · ${sla.label}`}
        </span>
        {job.technicianName && <span className="truncate text-sm text-gray-600">{job.technicianName}</span>}
      </div>
    </div>
  );
}
