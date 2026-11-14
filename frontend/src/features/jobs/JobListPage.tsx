import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Pencil, Plus, Trash2 } from "lucide-react";
import { useJobs, JobFilters } from "../../api/jobs";
import { FilterBar } from "./FilterBar";
import { SlaChip } from "../common/SlaChip";
import { StageStatusChip } from "../common/StageStatusChip";
import { JOB_TYPE_LABELS, PRIORITY_LABELS, STAGE_LABELS } from "../../constants";
import { useAuth } from "../../auth/AuthContext";
import { canCreateJob, canDeleteJob, canEditJobFields } from "../../auth/permissions";
import { Job, Priority } from "../../types";
import { formatCurrency } from "../../utils/currency";
import { formatDate, daysBetween } from "../../utils/date";
import { currentStageSla } from "../../utils/jobStatus";
import { plural } from "../../utils/text";
import { DeleteJobDialog } from "./DeleteJobDialog";
import { JobFieldDialog } from "./JobFieldDialog";
import { BulkDeleteJobsDialog } from "./BulkDeleteJobsDialog";
import { Badge, BadgeTone, Button, Card, Checkbox, IconButton, PageHeader, PageSpinner, cn } from "../../components/ui";
import { EmptyRow, STICKY_THEAD, TH, TD as TD_BASE } from "../../components/ui/Table";

const PRIORITY_TONE: Record<Priority, BadgeTone> = {
  HIGH: "danger",
  MEDIUM: "warning",
  LOW: "neutral",
};

const TD = `${TD_BASE} whitespace-nowrap`;

export function JobListPage() {
  const [filters, setFilters] = useState<JobFilters>({});
  const { data: jobs, isLoading } = useJobs(filters);
  const { user } = useAuth();
  const navigate = useNavigate();
  const [deletingJob, setDeletingJob] = useState<Job | null>(null);
  const [editingWoDateJob, setEditingWoDateJob] = useState<Job | null>(null);
  const missingWoCount = jobs?.filter((j) => !j.woNumber).length ?? 0;
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const canBulkDelete = canDeleteJob(user?.role);
  const selectableIds = jobs?.map((j) => j.id) ?? [];
  const allSelected = selectableIds.length > 0 && selectedIds.length === selectableIds.length;
  const someSelected = selectedIds.length > 0 && !allSelected;

  function toggleSelectAll() {
    setSelectedIds(allSelected ? [] : selectableIds);
  }

  function toggleSelectOne(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  return (
    <div>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            Jobs
            {missingWoCount > 0 && (
              <Badge tone="warning" icon={<AlertTriangle />} onClick={() => setFilters({ ...filters, missingWo: "true" })}>
                {plural(missingWoCount, "missing WO number")}
              </Badge>
            )}
          </span>
        }
      >
        {canBulkDelete && selectedIds.length > 0 && (
          <Button variant="danger-outline" icon={<Trash2 className="size-4" />} onClick={() => setBulkDeleting(true)}>
            Delete Selected ({selectedIds.length})
          </Button>
        )}
        {canCreateJob(user?.role) && (
          <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => navigate("/jobs/new")}>
            New Job
          </Button>
        )}
      </PageHeader>

      <FilterBar
        filters={filters}
        onChange={(next) => {
          setFilters(next);
          setSelectedIds([]);
        }}
      />

      {isLoading ? (
        <PageSpinner />
      ) : (
        <Card className="overflow-hidden">
          {/* The list scrolls inside this panel (sized to the screen) instead of the whole page,
              so the title, filters and buttons stay in view. Never shorter than 20rem. */}
          <div className="max-h-[max(20rem,calc(100dvh-22rem))] overflow-auto overscroll-contain">
            <table className="w-full text-sm">
              {/* Sticky header: a box-shadow stands in for the bottom border, which doesn't stick. */}
              <thead className={STICKY_THEAD}>
                <tr>
                  {canBulkDelete && (
                    <th className="w-10 px-3 py-2.5">
                      <Checkbox
                        aria-label="Select all jobs"
                        indeterminate={someSelected}
                        checked={allSelected}
                        onChange={toggleSelectAll}
                        disabled={selectableIds.length === 0}
                      />
                    </th>
                  )}
                  <th className={TH}>Reference #</th>
                  <th className={TH}>Customer</th>
                  <th className={TH}>Job Type</th>
                  <th className={TH}>Priority</th>
                  <th className={TH}>Created By</th>
                  <th className={TH}>WO Number</th>
                  <th className={TH}>WO Date</th>
                  <th className={TH}>Current Stage</th>
                  <th className={TH}>Status</th>
                  <th className={TH}>SLA</th>
                  <th className={cn(TH, "text-right")}>Job Age (days)</th>
                  <th className={cn(TH, "text-right")}>PO Value</th>
                  {canBulkDelete && <th className={cn(TH, "text-right")}>Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {jobs?.map((job) => {
                  const sla = currentStageSla(job);
                  const selected = selectedIds.includes(job.id);
                  return (
                    <tr
                      key={job.id}
                      onClick={() => navigate(`/jobs/${job.id}`)}
                      className={cn(
                        "cursor-pointer transition-colors",
                        selected
                          ? "bg-yellow-soft hover:bg-yellow-soft dark:bg-yellow/10"
                          : "hover:bg-gray-50 dark:hover:bg-gray-800/60"
                      )}
                    >
                      {canBulkDelete && (
                        <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            aria-label={`Select ${job.referenceNumber}`}
                            checked={selected}
                            onChange={() => toggleSelectOne(job.id)}
                          />
                        </td>
                      )}
                      <td className={cn(TD, "font-semibold text-gray-900 dark:text-gray-50")}>{job.referenceNumber}</td>
                      <td className={TD}>{job.customer}</td>
                      <td className={TD}>{JOB_TYPE_LABELS[job.jobType]}</td>
                      <td className={TD}>
                        <Badge tone={PRIORITY_TONE[job.priority]}>{PRIORITY_LABELS[job.priority]}</Badge>
                      </td>
                      <td className={TD}>{job.createdBy ? "Storeman" : "—"}</td>
                      <td className={TD}>
                        {job.woNumber ?? (
                          <Badge tone="warning" icon={<AlertTriangle />}>
                            Missing WO — {daysBetween(job.jobCreatedDate, new Date().toISOString())}d
                          </Badge>
                        )}
                      </td>
                      <td className={TD}>
                        <span className="inline-flex items-center gap-1">
                          {job.woNumberSetAt ? formatDate(job.woNumberSetAt) : "—"}
                          {job.woNumber && canEditJobFields(user?.role) && (
                            <IconButton
                              size="sm"
                              label="Edit WO date"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingWoDateJob(job);
                              }}
                            >
                              <Pencil />
                            </IconButton>
                          )}
                        </span>
                      </td>
                      <td className={TD}>{STAGE_LABELS[job.status.currentStage]}</td>
                      <td className={TD}>
                        <StageStatusChip status={job.status.currentStatus} />
                      </td>
                      <td className={TD}>
                        <SlaChip status={sla ? sla.status : "NOT_APPLICABLE"} />
                      </td>
                      <td className={cn(TD, "text-right tabular-nums")}>{job.status.totalJobAge}</td>
                      <td className={cn(TD, "text-right tabular-nums")}>{formatCurrency(Number(job.poValue))}</td>
                      {canBulkDelete && (
                        <td className={cn(TD, "text-right")}>
                          <IconButton
                            size="sm"
                            tone="danger"
                            label="Delete job"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeletingJob(job);
                            }}
                          >
                            <Trash2 />
                          </IconButton>
                        </td>
                      )}
                    </tr>
                  );
                })}
                {jobs?.length === 0 && (
                  <EmptyRow cols={canBulkDelete ? 14 : 12}>
                      No jobs match the current filters.
                  </EmptyRow>
                )}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-gray-200 bg-gray-50 px-4 py-2 text-xs text-gray-600 dark:border-gray-800 dark:bg-gray-800/60 dark:text-gray-400">
            <span>
              {jobs?.length ?? 0} job{jobs?.length === 1 ? "" : "s"}
            </span>
            {selectedIds.length > 0 && <span className="font-semibold text-gray-800 dark:text-gray-200">{selectedIds.length} selected</span>}
          </div>
        </Card>
      )}

      {deletingJob && <DeleteJobDialog job={deletingJob} onClose={() => setDeletingJob(null)} />}
      {editingWoDateJob && (
        <JobFieldDialog
          job={editingWoDateJob}
          field="woNumberSetAt"
          label="WO Number Date"
          onClose={() => setEditingWoDateJob(null)}
        />
      )}
      {bulkDeleting && (
        <BulkDeleteJobsDialog
          jobIds={selectedIds}
          onClose={() => setBulkDeleting(false)}
          onDeleted={() => {
            setBulkDeleting(false);
            setSelectedIds([]);
          }}
        />
      )}
    </div>
  );
}
