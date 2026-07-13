import {
  Box,
  IconButton,
  Step,
  StepContent,
  StepLabel,
  Stepper,
  Stack,
  Typography,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import { Job, StageName } from "../../types";
import { SlaChip } from "../common/SlaChip";
import { StageStatusChip } from "../common/StageStatusChip";
import { formatDate } from "../../utils/date";
import { useAuth } from "../../auth/AuthContext";
import { canEditStage } from "../../auth/permissions";
import { StageKey } from "../../api/jobs";

interface StepDef {
  key: StageName;
  label: string;
  editStage?: StageKey;
  completedDate: string | null | undefined;
  responsible: string | null | undefined;
  comments: string | null | undefined;
  delayReason: string | null | undefined;
}

export function StageTimeline({ job, onEdit }: { job: Job; onEdit: (stage: StageKey) => void }) {
  const { user } = useAuth();

  const steps: StepDef[] = [
    {
      key: "QUOTATION" as StageName,
      label: "Job Created",
      completedDate: job.jobCreatedDate,
      responsible: job.createdBy ? "Storeman" : null,
      comments: job.comments,
      delayReason: null,
    },
    {
      key: "QUOTATION",
      label: "Quotation",
      editStage: "quotation",
      completedDate: job.quotation?.epirocQuotationDate,
      responsible: job.quotation?.quotedBy ? "Planner" : null,
      comments: job.quotation?.comments,
      delayReason: job.quotation?.delayReason,
    },
    {
      key: "REPAIR",
      label: "Repair",
      editStage: "repair",
      completedDate: job.repair?.repairCompletionDate,
      responsible: job.repair?.technicianName || null,
      comments: job.repair?.comments,
      delayReason: job.repair?.delayReason,
    },
    {
      key: "DISPATCH",
      label: "Dispatch",
      editStage: "dispatch",
      completedDate: job.dispatch?.dispatchDate,
      responsible: job.dispatch?.dispatchedBy ? "Storeman" : null,
      comments: job.dispatch?.comments,
      delayReason: job.dispatch?.delayReason,
    },
    {
      key: "INVOICING",
      label: "Invoice",
      editStage: "invoice",
      completedDate: job.invoice?.invoiceDate,
      responsible: job.invoice?.invoiceNumber ? "Planner" : null,
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
  // treat it as REPAIR when locating which step the stepper should highlight as active.
  const effectiveStage = job.status.currentStage === "AWAITING_PO" ? "REPAIR" : job.status.currentStage;
  const activeIndex = job.status.isClosed
    ? steps.length - 1
    : Math.max(
        1,
        steps.findIndex((s, idx) => idx > 0 && s.key === effectiveStage)
      );

  const slaByStage = Object.fromEntries(job.status.stages.map((s) => [s.name, s]));

  return (
    <Stepper activeStep={activeIndex} orientation="vertical">
      {steps.map((step, idx) => {
        const computed = idx > 0 && idx < steps.length - 1 ? slaByStage[step.key] : undefined;
        const isCompleted = idx === 0 || Boolean(step.completedDate) || (idx === steps.length - 1 && job.status.isClosed);
        return (
          <Step key={`${step.key}-${idx}`} completed={isCompleted}>
            <StepLabel>
              <Stack direction="row" alignItems="center" spacing={1}>
                <Typography fontWeight={600}>{step.label}</Typography>
                {computed && <StageStatusChip status={computed.status} />}
                {idx === steps.length - 1 && job.status.isClosed && <StageStatusChip status="CLOSED" />}
              </Stack>
            </StepLabel>
            <StepContent>
              <Stack spacing={0.5} sx={{ pb: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  Date: {formatDate(step.completedDate)}
                  {step.responsible ? ` · ${step.responsible}` : ""}
                </Typography>
                {computed && (
                  <Stack direction="row" spacing={1} alignItems="center">
                    <SlaChip status={computed.sla.status} />
                    <Typography variant="caption" color="text.secondary">
                      {computed.sla.days !== null
                        ? `${computed.sla.days} of ${computed.sla.target} target days`
                        : "Not yet applicable"}
                    </Typography>
                  </Stack>
                )}
                {step.comments && <Typography variant="body2">Comments: {step.comments}</Typography>}
                {step.delayReason && (
                  <Typography variant="body2" color="error.main">
                    Delay reason: {step.delayReason}
                  </Typography>
                )}
                {step.editStage && canEditStage(user?.role, step.editStage) && (
                  <Box>
                    <IconButton size="small" onClick={() => onEdit(step.editStage!)}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Box>
                )}
              </Stack>
            </StepContent>
          </Step>
        );
      })}
    </Stepper>
  );
}
