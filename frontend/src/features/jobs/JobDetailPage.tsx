import { ReactNode, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Grid,
  IconButton,
  Stack,
  Typography,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import { useJob } from "../../api/jobs";
import { StageKey } from "../../api/jobs";
import { StageTimeline } from "./StageTimeline";
import { AuditLogPanel } from "./AuditLogPanel";
import { JobFieldDialog, JobEditableField } from "./JobFieldDialog";
import { DeleteJobDialog } from "./DeleteJobDialog";
import { QuotationDialog } from "./stageForms/QuotationDialog";
import { RepairDialog } from "./stageForms/RepairDialog";
import { DispatchDialog } from "./stageForms/DispatchDialog";
import { InvoiceDialog } from "./stageForms/InvoiceDialog";
import { JOB_TYPE_LABELS, PRIORITY_LABELS, STAGE_LABELS } from "../../constants";
import { SlaChip } from "../common/SlaChip";
import { StageStatusChip } from "../common/StageStatusChip";
import { formatDate, daysBetween } from "../../utils/date";
import { formatCurrency } from "../../utils/currency";
import { useAuth } from "../../auth/AuthContext";
import { canEditJobFields, canDeleteJob } from "../../auth/permissions";

const FIELD_LABELS: Record<JobEditableField, string> = {
  woNumber: "WO Number",
  poNumber: "PO Number",
  woNumberSetAt: "WO Number Date",
};

export function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: job, isLoading } = useJob(id);
  const [activeDialog, setActiveDialog] = useState<StageKey | null>(null);
  const [editingField, setEditingField] = useState<JobEditableField | null>(null);
  const [deleting, setDeleting] = useState(false);

  if (isLoading || !job) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  const currentStageSla = job.status.isClosed
    ? null
    : job.status.stages.find((s) => s.name === job.status.currentStage)?.sla ?? null;

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate("/jobs")}>
          Back to Jobs
        </Button>
        {canDeleteJob(user?.role) && (
          <Button color="error" startIcon={<DeleteIcon />} onClick={() => setDeleting(true)}>
            Delete Job
          </Button>
        )}
      </Stack>

      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>
            {job.referenceNumber} — {job.customer}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {job.description}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Chip label={PRIORITY_LABELS[job.priority]} />
          <Chip label={JOB_TYPE_LABELS[job.jobType]} variant="outlined" />
        </Stack>
      </Stack>

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={6} sm={3}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="caption" color="text.secondary">
                Current Stage
              </Typography>
              <Typography variant="h6">{STAGE_LABELS[job.status.currentStage]}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="caption" color="text.secondary">
                Status
              </Typography>
              <Box sx={{ mt: 0.5 }}>
                <StageStatusChip status={job.status.currentStatus} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="caption" color="text.secondary">
                Days in Current Stage
              </Typography>
              <Typography variant="h6">{job.status.daysInCurrentStage ?? "—"}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="caption" color="text.secondary">
                Total Job Age (days)
              </Typography>
              <Typography variant="h6">{job.status.totalJobAge}</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid item xs={12} md={5}>
          <Card variant="outlined" sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>
                Job Details
              </Typography>
              <Stack spacing={1}>
                <DetailRow label="Serial Number" value={job.serialNumber} />
                <DetailRow label="Part Number" value={job.partNumber ?? "—"} />
                <DetailRow
                  label="WO Number"
                  value={
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      {job.woNumber ? (
                        <Typography variant="body2" fontWeight={500}>
                          {job.woNumber}
                        </Typography>
                      ) : (
                        <Chip
                          size="small"
                          color="warning"
                          label={`Awaiting WO — ${daysBetween(job.jobCreatedDate, new Date().toISOString())}d`}
                        />
                      )}
                      {canEditJobFields(user?.role) && (
                        <IconButton size="small" onClick={() => setEditingField("woNumber")}>
                          <EditIcon fontSize="inherit" />
                        </IconButton>
                      )}
                    </Stack>
                  }
                />
                {job.woNumber && job.woNumberSetAt && (
                  <DetailRow
                    label="WO Number Submitted"
                    value={
                      <Stack direction="row" spacing={0.5} alignItems="center">
                        <Typography variant="body2" fontWeight={500}>
                          {`${formatDate(job.woNumberSetAt)} (${daysBetween(job.jobCreatedDate, job.woNumberSetAt)}d after job creation)`}
                        </Typography>
                        {canEditJobFields(user?.role) && (
                          <IconButton size="small" onClick={() => setEditingField("woNumberSetAt")}>
                            <EditIcon fontSize="inherit" />
                          </IconButton>
                        )}
                      </Stack>
                    }
                  />
                )}
                <DetailRow
                  label="PO Number"
                  value={
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <Typography variant="body2" fontWeight={500}>
                        {job.poNumber ?? "—"}
                      </Typography>
                      {canEditJobFields(user?.role) && (
                        <IconButton size="small" onClick={() => setEditingField("poNumber")}>
                          <EditIcon fontSize="inherit" />
                        </IconButton>
                      )}
                    </Stack>
                  }
                />
                <DetailRow label="Created By" value={job.createdBy ? "Storeman" : "—"} />
                <DetailRow label="Job Created Date" value={formatDate(job.jobCreatedDate)} />
                <DetailRow label="PO Value" value={formatCurrency(Number(job.poValue))} />
                <DetailRow
                  label="Overall SLA Compliance"
                  value={
                    <SlaChip status={job.status.slaCompliant ? "GREEN" : "RED"} />
                  }
                />
                {currentStageSla && (
                  <DetailRow label="Current Stage SLA" value={<SlaChip status={currentStageSla.status} />} />
                )}
                {job.comments && <DetailRow label="Comments" value={job.comments} />}
              </Stack>
            </CardContent>
          </Card>
          <AuditLogPanel jobId={job.id} />
        </Grid>
        <Grid item xs={12} md={7}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>
                Lifecycle Timeline
              </Typography>
              <StageTimeline job={job} onEdit={setActiveDialog} />
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {activeDialog === "quotation" && <QuotationDialog job={job} onClose={() => setActiveDialog(null)} />}
      {activeDialog === "repair" && <RepairDialog job={job} onClose={() => setActiveDialog(null)} />}
      {activeDialog === "dispatch" && <DispatchDialog job={job} onClose={() => setActiveDialog(null)} />}
      {activeDialog === "invoice" && <InvoiceDialog job={job} onClose={() => setActiveDialog(null)} />}
      {editingField && (
        <JobFieldDialog
          job={job}
          field={editingField}
          label={FIELD_LABELS[editingField]}
          onClose={() => setEditingField(null)}
        />
      )}
      {deleting && (
        <DeleteJobDialog job={job} onClose={() => setDeleting(false)} onDeleted={() => navigate("/jobs")} />
      )}
    </Box>
  );
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Stack direction="row" justifyContent="space-between">
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2" fontWeight={500}>
        {value}
      </Typography>
    </Stack>
  );
}
