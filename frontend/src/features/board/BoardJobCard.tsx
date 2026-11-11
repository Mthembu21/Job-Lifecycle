import { Box, Stack, Typography } from "@mui/material";
import { BoardJob } from "../../api/board";
import { PRIORITY_LABELS, STAGE_STATUS_LABELS } from "../../constants";
import { SlaColor } from "../../types";

const SLA_ACCENT: Record<SlaColor, string> = {
  GREEN: "#2E7D32",
  AMBER: "#F4A100",
  RED: "#D93025",
  NOT_APPLICABLE: "#3A3F44",
};

export function BoardJobCard({ job }: { job: BoardJob }) {
  const currentStageInfo = job.stages.find((s) => s.name === job.currentStage);
  const accent = job.isClosed
    ? SLA_ACCENT.GREEN
    : currentStageInfo
      ? SLA_ACCENT[currentStageInfo.slaStatus]
      : SLA_ACCENT.NOT_APPLICABLE;

  return (
    <Box
      sx={{
        bgcolor: "background.paper",
        borderRadius: 2,
        borderLeft: "5px solid",
        borderLeftColor: accent,
        p: 2,
        display: "flex",
        flexDirection: "column",
        gap: 0.5,
        minWidth: 0,
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="baseline" spacing={1}>
        <Typography variant="h6" fontWeight={700} noWrap>
          {job.referenceNumber}
        </Typography>
        <Typography variant="caption" sx={{ opacity: 0.6, textTransform: "uppercase", letterSpacing: 0.5, flexShrink: 0 }}>
          {PRIORITY_LABELS[job.priority]}
        </Typography>
      </Stack>
      <Typography variant="body1" sx={{ opacity: 0.9 }} noWrap>
        {job.customer}
      </Typography>
      <Typography variant="body2" sx={{ opacity: 0.55 }} noWrap>
        {job.description}
      </Typography>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 1 }}>
        <Typography variant="caption" sx={{ opacity: 0.75, fontWeight: 600 }}>
          {STAGE_STATUS_LABELS[job.currentStatus]}
        </Typography>
        {job.technicianName && (
          <Typography variant="caption" sx={{ opacity: 0.6 }} noWrap>
            {job.technicianName}
          </Typography>
        )}
      </Stack>
    </Box>
  );
}
