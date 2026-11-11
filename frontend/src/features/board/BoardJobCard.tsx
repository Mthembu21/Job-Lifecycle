import { Card, CardContent, Chip, Stack, Typography } from "@mui/material";
import { BoardJob } from "../../api/board";
import { StageStatusChip } from "../common/StageStatusChip";
import { SlaChip } from "../common/SlaChip";
import { PRIORITY_LABELS } from "../../constants";

const PRIORITY_COLOR: Record<string, "error" | "warning" | "default"> = {
  HIGH: "error",
  MEDIUM: "warning",
  LOW: "default",
};

export function BoardJobCard({ job }: { job: BoardJob }) {
  const currentStageInfo = job.stages.find((s) => s.name === job.currentStage);

  return (
    <Card variant="outlined" sx={{ mb: 1.5, bgcolor: "background.default" }}>
      <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
          <Typography variant="subtitle1" fontWeight={700}>
            {job.referenceNumber}
          </Typography>
          <Chip size="small" label={PRIORITY_LABELS[job.priority]} color={PRIORITY_COLOR[job.priority]} />
        </Stack>
        <Typography variant="body2" sx={{ opacity: 0.8, mb: 1 }} noWrap>
          {job.customer}
        </Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <StageStatusChip status={job.currentStatus} />
          {currentStageInfo && <SlaChip status={currentStageInfo.slaStatus} />}
        </Stack>
        {job.technicianName && (
          <Typography variant="caption" sx={{ display: "block", mt: 1, opacity: 0.7 }}>
            Tech: {job.technicianName}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}
