import { BoardJob } from "../../api/board";
import { PRIORITY_LABELS, STAGE_STATUS_LABELS } from "../../constants";
import { SlaColor } from "../../types";

// Literal class names, not string-interpolated — Tailwind's scanner only
// picks up class strings it can find written out in the source.
const SLA_BORDER_CLASS: Record<SlaColor, string> = {
  GREEN: "border-l-green-600",
  AMBER: "border-l-amber-500",
  RED: "border-l-red-600",
  NOT_APPLICABLE: "border-l-gray-600",
};

export function BoardJobCard({ job }: { job: BoardJob }) {
  const currentStageInfo = job.stages.find((s) => s.name === job.currentStage);
  const borderClass = job.isClosed
    ? SLA_BORDER_CLASS.GREEN
    : currentStageInfo
      ? SLA_BORDER_CLASS[currentStageInfo.slaStatus]
      : SLA_BORDER_CLASS.NOT_APPLICABLE;

  return (
    <div className={`flex flex-col gap-1 rounded-lg border-l-[5px] bg-board-panel p-4 ${borderClass}`}>
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="truncate text-lg font-bold">{job.referenceNumber}</h3>
        <span className="shrink-0 text-xs tracking-wide text-white/60 uppercase">
          {PRIORITY_LABELS[job.priority]}
        </span>
      </div>
      <p className="truncate text-base text-white/90">{job.customer}</p>
      <p className="truncate text-sm text-white/55">{job.description}</p>
      <div className="mt-1 flex items-center justify-between">
        <span className="text-xs font-semibold text-white/75">{STAGE_STATUS_LABELS[job.currentStatus]}</span>
        {job.technicianName && <span className="truncate text-xs text-white/60">{job.technicianName}</span>}
      </div>
    </div>
  );
}
