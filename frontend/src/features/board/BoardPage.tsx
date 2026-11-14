import { useEffect, useMemo, useState } from "react";
import { BoardJob, useBoardJobs } from "../../api/board";
import { BoardJobCard } from "./BoardJobCard";
import { STAGE_LABELS } from "../../constants";
import { StageName } from "../../types";
import { Logo } from "../../components/ui";

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
    // Always light (no dark: variants) — it's a shared meeting-room screen, independent of
    // whichever theme this browser last used.
    <div className="flex h-screen flex-col overflow-hidden bg-gray-100 text-gray-900">
      <header className="flex items-center justify-between gap-6 border-b-4 border-yellow bg-white px-8 py-4 shadow-sm">
        <div className="flex items-center gap-5">
          <Logo variant="color" className="h-9" />
          <span aria-hidden className="h-8 w-px bg-gray-200" />
          <h1 className="text-2xl font-bold tracking-tight text-gray-800">Job Lifecycle Board</h1>
        </div>
        <div className="flex items-center gap-8">
          <div className="hidden items-center gap-4 text-sm text-gray-600 lg:flex">
            <span className="flex items-center gap-1.5">
              <span className="size-3 rounded-full bg-success" /> On track
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-3 rounded-full bg-yellow" /> Approaching SLA
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-3 rounded-full bg-danger" /> Overdue
            </span>
          </div>
          <div className="text-right leading-tight">
            <p className="text-2xl font-semibold text-gray-800 tabular-nums">{now.toLocaleTimeString()}</p>
            <p className="text-xs text-gray-500">
              Updated {dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString() : "—"}
            </p>
          </div>
        </div>
      </header>

      {!isLoading && activeStages.length > 1 && (
        <div className="relative h-1 overflow-hidden bg-gray-200">
          {/* Duration comes from a JS constant, so this one has to be an
              inline style — Tailwind can only scan static literal classes. */}
          <div
            key={currentStage}
            className="absolute inset-0 origin-left bg-yellow"
            style={{ animation: `board-progress ${STAGE_DURATION_MS}ms linear forwards` }}
          />
        </div>
      )}

      <div className="flex gap-3 px-8 py-5">
        {COLUMNS.map((stage) => {
          const count = byStage.get(stage)?.length ?? 0;
          const isActive = stage === currentStage;
          return (
            <div
              key={stage}
              className={`flex-1 rounded-xl border px-3 py-3 text-center transition-all duration-500 ${
                isActive
                  ? "scale-[1.03] border-yellow bg-yellow text-gray-900 shadow-md"
                  : "border-gray-200 bg-white text-gray-700 shadow-sm"
              } ${count === 0 ? "opacity-45" : "opacity-100"}`}
            >
              <p className="text-base font-bold">{STAGE_LABELS[stage]}</p>
              <p className={`text-3xl font-extrabold tabular-nums ${isActive ? "text-gray-900" : "text-gray-800"}`}>
                {count}
              </p>
              <p className={`text-xs ${isActive ? "text-gray-800" : "text-gray-500"}`}>job{count === 1 ? "" : "s"}</p>
            </div>
          );
        })}
      </div>

      <div className="min-h-0 flex-1 px-8 pb-8">
        {isLoading ? (
          <p className="mt-16 text-center text-xl text-gray-500">Loading…</p>
        ) : (
          <div
            key={currentStage ?? "empty"}
            className="flex h-full min-h-0 flex-col animate-[board-fade-in_0.6s_ease]"
          >
            <h2 className="mb-5 flex shrink-0 items-center gap-4 text-4xl font-extrabold tracking-tight text-gray-800">
              <span aria-hidden className="h-10 w-2 rounded-full bg-yellow" />
              {currentStage ? STAGE_LABELS[currentStage] : "No open jobs"}
              {currentStage && (
                <span className="text-2xl font-semibold text-gray-500">
                  {currentJobs.length} job{currentJobs.length === 1 ? "" : "s"}
                </span>
              )}
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
