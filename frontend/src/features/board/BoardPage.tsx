import { useEffect, useMemo, useState } from "react";
import { Box, CircularProgress, Stack, ThemeProvider, Typography, createTheme } from "@mui/material";
import { BoardJob, useBoardJobs } from "../../api/board";
import { BoardJobCard } from "./BoardJobCard";
import { STAGE_LABELS } from "../../constants";
import { StageName } from "../../types";
import { EPIROC_BLACK, EPIROC_YELLOW } from "../../theme/epirocBrand";

const COLUMNS: StageName[] = ["QUOTATION", "AWAITING_PO", "REPAIR", "DISPATCH", "INVOICING", "CLOSED"];

// This screen stays up on a meeting-room TV regardless of anyone's personal
// light/dark preference, so it carries its own fixed dark theme instead of
// reading the shared ThemeModeContext.
const boardTheme = createTheme({
  palette: {
    mode: "dark",
    primary: { main: EPIROC_YELLOW, contrastText: EPIROC_BLACK },
    background: { default: "#0B0E11", paper: "#15191D" },
  },
});

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

  return (
    <ThemeProvider theme={boardTheme}>
      <Box
        sx={{
          minHeight: "100vh",
          bgcolor: "background.default",
          color: "text.primary",
          p: 2,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ mb: 2, flexShrink: 0 }}>
          <Typography variant="h4" fontWeight={700} sx={{ color: EPIROC_YELLOW }}>
            Job Lifecycle Board
          </Typography>
          <Stack direction="row" spacing={3} alignItems="baseline">
            <Typography variant="body2" sx={{ opacity: 0.6 }}>
              Last updated {dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString() : "—"}
            </Typography>
            <Typography variant="h5" fontFamily="monospace">
              {now.toLocaleTimeString()}
            </Typography>
          </Stack>
        </Stack>

        {isLoading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Stack direction="row" spacing={2} sx={{ flex: 1, minHeight: 0 }}>
            {COLUMNS.map((stage) => {
              const stageJobs = byStage.get(stage) ?? [];
              return (
                <Box
                  key={stage}
                  sx={{
                    flex: 1,
                    minWidth: 0,
                    display: "flex",
                    flexDirection: "column",
                    bgcolor: "background.paper",
                    borderRadius: 2,
                    p: 1.5,
                  }}
                >
                  <Stack direction="row" justifyContent="space-between" sx={{ mb: 1, flexShrink: 0 }}>
                    <Typography variant="subtitle1" fontWeight={700}>
                      {STAGE_LABELS[stage]}
                    </Typography>
                    <Typography variant="subtitle1" sx={{ opacity: 0.6 }}>
                      {stageJobs.length}
                    </Typography>
                  </Stack>
                  <Box sx={{ overflowY: "auto", flex: 1, minHeight: 0 }}>
                    {stageJobs.map((job) => (
                      <BoardJobCard key={job.id} job={job} />
                    ))}
                    {stageJobs.length === 0 && (
                      <Typography variant="body2" sx={{ opacity: 0.4, textAlign: "center", mt: 2 }}>
                        No jobs
                      </Typography>
                    )}
                  </Box>
                </Box>
              );
            })}
          </Stack>
        )}
      </Box>
    </ThemeProvider>
  );
}
