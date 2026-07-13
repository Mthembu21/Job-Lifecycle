import { Box, Chip, Paper, Stack, Typography } from "@mui/material";
import { useJobAudit } from "../../api/jobs";
import { ROLE_LABELS } from "../../constants";

export function AuditLogPanel({ jobId }: { jobId: string }) {
  const { data: logs, isLoading } = useJobAudit(jobId);

  if (isLoading) return null;

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>
        Audit Trail
      </Typography>
      <Stack spacing={1.5} sx={{ maxHeight: 360, overflowY: "auto" }}>
        {logs?.length === 0 && (
          <Typography variant="body2" color="text.secondary">
            No changes recorded yet.
          </Typography>
        )}
        {logs?.map((entry) => {
          const changes = entry.summary.includes(": ") ? entry.summary.split("; ") : null;
          return (
            <Box key={entry.id} sx={{ borderLeft: "2px solid", borderColor: "divider", pl: 1.5 }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Chip size="small" label={entry.stage} />
                <Typography variant="caption" color="text.secondary">
                  {new Date(entry.changedAt).toLocaleString()} ·{" "}
                  {entry.changedBy.role ? ROLE_LABELS[entry.changedBy.role] : entry.changedBy.name}
                </Typography>
              </Stack>
              {changes ? (
                <Stack component="ul" spacing={0.25} sx={{ m: 0, pl: 2.5 }}>
                  {changes.map((change, i) => (
                    <Typography key={i} component="li" variant="body2">
                      {change}
                    </Typography>
                  ))}
                </Stack>
              ) : (
                <Typography variant="body2">{entry.summary}</Typography>
              )}
              {entry.comment && (
                <Typography variant="caption" color="text.secondary">
                  "{entry.comment}"
                </Typography>
              )}
            </Box>
          );
        })}
      </Stack>
    </Paper>
  );
}
