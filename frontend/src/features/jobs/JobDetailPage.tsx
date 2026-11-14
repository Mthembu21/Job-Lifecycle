import { ReactNode, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import { useJob } from "../../api/jobs";
import { StageKey } from "../../api/jobs";
import { StageTimeline } from "./StageTimeline";
import { AuditLogPanel } from "./AuditLogPanel";
import { ForecastCard } from "./ForecastCard";
import { JobTypeDialog } from "./JobTypeDialog";
import { isNonInvoicedJobType } from "../../utils/jobTypes";
import { JobFieldDialog, JobEditableField } from "./JobFieldDialog";
import { DeleteJobDialog } from "./DeleteJobDialog";
import { DeleteStageDialog } from "./stageForms/DeleteStageDialog";
import { QuotationDialog } from "./stageForms/QuotationDialog";
import { RepairDialog } from "./stageForms/RepairDialog";
import { DispatchDialog } from "./stageForms/DispatchDialog";
import { InvoiceDialog } from "./stageForms/InvoiceDialog";
import { JOB_TYPE_LABELS, PRIORITY_LABELS, STAGE_LABELS } from "../../constants";
import { SlaChip } from "../common/SlaChip";
import { StageStatusChip } from "../common/StageStatusChip";
import { formatDate, daysBetween } from "../../utils/date";
import { currentStageSla } from "../../utils/jobStatus";
import { formatCurrency } from "../../utils/currency";
import { useAuth } from "../../auth/AuthContext";
import { canEditJobFields, canDeleteJob } from "../../auth/permissions";
import { Badge, Button, Card, CardTitle, IconButton, PageHeader, PageSpinner } from "../../components/ui";

const FIELD_LABELS: Record<JobEditableField, string> = {
  woNumber: "WO Number",
  poNumber: "PO Number",
  woNumberSetAt: "WO Number Date",
  jobCreatedDate: "Job Opening",
};

export function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: job, isLoading } = useJob(id);
  const [activeDialog, setActiveDialog] = useState<StageKey | null>(null);
  const [editingField, setEditingField] = useState<JobEditableField | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deletingStage, setDeletingStage] = useState<StageKey | null>(null);
  const [editingType, setEditingType] = useState(false);

  if (isLoading || !job) return <PageSpinner />;

  const stageSla = currentStageSla(job);
  const canEdit = canEditJobFields(user?.role);

  const editButton = (field: JobEditableField) =>
    canEdit && (
      <IconButton size="sm" label={`Edit ${FIELD_LABELS[field]}`} onClick={() => setEditingField(field)}>
        <Pencil />
      </IconButton>
    );

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <Button variant="ghost" size="sm" icon={<ArrowLeft className="size-4" />} onClick={() => navigate("/jobs")}>
          Back to Jobs
        </Button>
        {canDeleteJob(user?.role) && (
          <Button variant="danger-outline" size="sm" icon={<Trash2 className="size-4" />} onClick={() => setDeleting(true)}>
            Delete Job
          </Button>
        )}
      </div>

      <PageHeader
        title={
          <>
            {job.referenceNumber} <span className="font-normal text-gray-400">—</span> {job.customer}
          </>
        }
        subtitle={job.description}
      >
        <Badge size="md" tone="brand">
          {PRIORITY_LABELS[job.priority]} priority
        </Badge>
        <Badge size="md" tone="outline">
          {JOB_TYPE_LABELS[job.jobType]}
        </Badge>
      </PageHeader>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SummaryTile label="Current Stage">{STAGE_LABELS[job.status.currentStage]}</SummaryTile>
        <SummaryTile label="Status">
          <StageStatusChip status={job.status.currentStatus} />
        </SummaryTile>
        <SummaryTile label="Days in Current Stage">{job.status.daysInCurrentStage ?? "—"}</SummaryTile>
        <SummaryTile label="Total Job Age (days)">{job.status.totalJobAge}</SummaryTile>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="flex flex-col gap-4 lg:col-span-5">
          <Card className="p-5">
            <CardTitle>Job Details</CardTitle>
            <dl className="divide-y divide-gray-100 dark:divide-gray-800">
              <DetailRow
                label="Service Type"
                value={
                  <>
                    {JOB_TYPE_LABELS[job.jobType]}
                    {isNonInvoicedJobType(job.jobType) && <Badge tone="neutral">Not invoiced</Badge>}
                    {canEdit && (
                      <IconButton size="sm" label="Edit Service Type" onClick={() => setEditingType(true)}>
                        <Pencil />
                      </IconButton>
                    )}
                  </>
                }
              />
              <DetailRow label="Serial Nr" value={job.serialNumber} />
              <DetailRow label="Part Nr" value={job.partNumber ?? "—"} />
              <DetailRow label="Machine Nr" value={job.machineNumber ?? "—"} />
              <DetailRow label="Machine Serial Nr" value={job.machineSerialNumber ?? "—"} />
              <DetailRow label="Customer Ref" value={job.customerRef ?? "—"} />
              <DetailRow label="Customer Acc" value={job.customerAccount ?? "—"} />
              <DetailRow label="Date Received" value={job.dateReceived ? formatDate(job.dateReceived) : "—"} />
              <DetailRow
                label="WO Number"
                value={
                  <>
                    {job.woNumber ?? (
                      <Badge tone="warning">Awaiting WO — {daysBetween(job.jobCreatedDate, new Date().toISOString())}d</Badge>
                    )}
                    {editButton("woNumber")}
                  </>
                }
              />
              {job.woNumber && job.woNumberSetAt && (
                <DetailRow
                  label="WO Number Submitted"
                  value={
                    <>
                      {`${formatDate(job.woNumberSetAt)} (${daysBetween(job.jobCreatedDate, job.woNumberSetAt)}d after job creation)`}
                      {editButton("woNumberSetAt")}
                    </>
                  }
                />
              )}
              <DetailRow
                label="PO Number"
                value={
                  <>
                    {job.poNumber ?? "—"}
                    {editButton("poNumber")}
                  </>
                }
              />
              <DetailRow label="Created By" value={job.createdBy?.name ?? "—"} />
              <DetailRow
                label="Job Opening"
                value={
                  <>
                    {formatDate(job.jobCreatedDate)}
                    {editButton("jobCreatedDate")}
                  </>
                }
              />
              <DetailRow label="Order Value" value={formatCurrency(Number(job.poValue))} />
              <DetailRow label="Overall SLA Compliance" value={<SlaChip status={job.status.slaCompliant ? "GREEN" : "RED"} />} />
              {stageSla && <DetailRow label="Current Stage SLA" value={<SlaChip status={stageSla.status} />} />}
              {job.comments && <DetailRow label="Comment" value={job.comments} />}
            </dl>
          </Card>
          <ForecastCard job={job} />
          <AuditLogPanel jobId={job.id} />
        </div>
        <div className="lg:col-span-7">
          <Card className="p-5">
            <CardTitle>Lifecycle Timeline</CardTitle>
            <StageTimeline job={job} onEdit={setActiveDialog} onDelete={setDeletingStage} />
          </Card>
        </div>
      </div>

      {activeDialog === "quotation" && <QuotationDialog job={job} onClose={() => setActiveDialog(null)} />}
      {activeDialog === "repair" && <RepairDialog job={job} onClose={() => setActiveDialog(null)} />}
      {activeDialog === "dispatch" && <DispatchDialog job={job} onClose={() => setActiveDialog(null)} />}
      {activeDialog === "invoice" && <InvoiceDialog job={job} onClose={() => setActiveDialog(null)} />}
      {editingField && (
        <JobFieldDialog job={job} field={editingField} label={FIELD_LABELS[editingField]} onClose={() => setEditingField(null)} />
      )}
      {deleting && <DeleteJobDialog job={job} onClose={() => setDeleting(false)} onDeleted={() => navigate("/jobs")} />}
      {deletingStage && <DeleteStageDialog jobId={job.id} stage={deletingStage} onClose={() => setDeletingStage(null)} />}
      {editingType && <JobTypeDialog job={job} onClose={() => setEditingType(false)} />}
    </div>
  );
}

function SummaryTile({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Card className="p-4">
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</p>
      <div className="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-50">{children}</div>
    </Card>
  );
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2 text-sm">
      <dt className="shrink-0 text-gray-500 dark:text-gray-400">{label}</dt>
      <dd className="flex min-w-0 items-center justify-end gap-1 text-right font-medium text-gray-900 dark:text-gray-100">
        {value}
      </dd>
    </div>
  );
}
