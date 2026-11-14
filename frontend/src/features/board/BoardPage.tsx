import { useEffect, useMemo, useState } from "react";
import { BoardJob, useBoardJobs } from "../../api/board";
import { BoardJobCard } from "./BoardJobCard";
import { STAGE_LABELS } from "../../constants";
import { StageName } from "../../types";

const COLUMNS: StageName[] = ["QUOTATION", "AWAITING_PO", "REPAIR", "DISPATCH", "INVOICING", "CLOSED"];

// Seconds each stage stays full-screen before rotating to the next one.
const STAGE_DURATION_MS = 10_000;

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

export function BoardPage() {
  const { data: jobs, isLoading, dataUpdatedAt } = useBoardJobs();
  const now = useClock();

  const byStage = useMemo(() => {
    const map = new Map<StageName, BoardJob[]>();
    for (const stage of COLUMNS) map.set(stage, []);
    for (const job of jobs ?? []) {
      map.get(job.currentStage)?.push(job);
    }
    return map;
  }, [jobs]);

  // Only rotate through stages that currently have at least one job — no
  // point giving an empty stage its 10 seconds of screen time.
  const activeStages = useMemo(() => COLUMNS.filter((s) => (byStage.get(s)?.length ?? 0) > 0), [byStage]);

  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (index >= activeStages.length) setIndex(0);
  }, [activeStages.length, index]);

  useEffect(() => {
    if (activeStages.length <= 1) return;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % activeStages.length);
    }, STAGE_DURATION_MS);
    return () => clearInterval(id);
  }, [activeStages.length]);

  const currentStage = activeStages[index] ?? null;
  const currentJobs = currentStage ? byStage.get(currentStage) ?? [] : [];

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-board-bg text-white">
      <div className="flex items-baseline justify-between px-6 pt-5 pb-3">
        <h1 className="text-lg font-bold text-white/85">Job Lifecycle Board</h1>
        <div className="flex items-baseline gap-6">
          <span className="text-sm text-white/50">
            Updated {dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString() : "—"}
          </span>
          <span className="font-mono text-lg text-white/85">{now.toLocaleTimeString()}</span>
        </div>
      </div>

      {!isLoading && activeStages.length > 1 && (
        <div className="relative h-[3px] overflow-hidden bg-white/5">
          {/* Duration comes from a JS constant, so this one has to be an
              inline style — Tailwind can only scan static literal classes. */}
          <div
            key={currentStage}
            className="absolute inset-0 origin-left bg-epiroc-yellow"
            style={{ animation: `board-progress ${STAGE_DURATION_MS}ms linear forwards` }}
          />
        </div>
      )}

      <div className="flex gap-3 px-6 py-4">
        {COLUMNS.map((stage) => {
          const count = byStage.get(stage)?.length ?? 0;
          const isActive = stage === currentStage;
          return (
            <div
              key={stage}
              className={`flex-1 rounded-lg py-2 text-center transition-colors duration-500 ${
                isActive ? "bg-epiroc-yellow text-epiroc-black" : "bg-board-panel text-white"
              } ${count === 0 ? "opacity-40" : "opacity-100"}`}
            >
              <p className="text-sm font-bold">{STAGE_LABELS[stage]}</p>
              <p className="text-xs opacity-80">
                {count} job{count === 1 ? "" : "s"}
              </p>
            </div>
          );
        })}
      </div>

      <div className="min-h-0 flex-1 px-6 pb-6">
        {isLoading ? (
          <p className="mt-16 text-center text-xl text-white/50">Loading…</p>
        ) : (
          <div
            key={currentStage ?? "empty"}
            className="flex h-full min-h-0 flex-col animate-[board-fade-in_0.6s_ease]"
          >
            <h2 className="mb-4 shrink-0 text-4xl font-extrabold text-epiroc-yellow">
              {currentStage ? STAGE_LABELS[currentStage] : "No open jobs"}
            </h2>
            <div className="grid min-h-0 flex-1 auto-rows-min grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4 overflow-y-auto">
              {currentJobs.map((job) => (
                <BoardJobCard key={job.id} job={job} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
