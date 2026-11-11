import { useEffect, useMemo, useState } from "react";
import { Box, Fade, Stack, ThemeProvider, Typography, createTheme } from "@mui/material";
import { BoardJob, useBoardJobs } from "../../api/board";
import { BoardJobCard } from "./BoardJobCard";
import { STAGE_LABELS } from "../../constants";
import { StageName } from "../../types";
import { EPIROC_BLACK, EPIROC_YELLOW } from "../../theme/epirocBrand";

const COLUMNS: StageName[] = ["QUOTATION", "AWAITING_PO", "REPAIR", "DISPATCH", "INVOICING", "CLOSED"];

// Seconds each stage stays full-screen before rotating to the next one.
const STAGE_DURATION_MS = 10_000;

// This screen stays up on a meeting-room TV regardless of anyone's personal
// light/dark preference, so it carries its own fixed dark theme instead of
// reading the shared ThemeModeContext.
const boardTheme = createTheme({
  palette: {
    mode: "dark",
    primary: { main: EPIROC_YELLOW, contrastText: EPIROC_BLACK },
    background: { default: "#0B0E11", paper: "#15191D" },
  },
  shape: { borderRadius: 10 },
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
    <ThemeProvider theme={boardTheme}>
      <Box
        sx={{
          height: "100vh",
          bgcolor: "background.default",
          color: "text.primary",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ px: 3, pt: 2.5, pb: 1.5 }}>
          <Typography variant="h6" fontWeight={700} sx={{ opacity: 0.85 }}>
            Job Lifecycle Board
          </Typography>
          <Stack direction="row" spacing={3} alignItems="baseline">
            <Typography variant="body2" sx={{ opacity: 0.5 }}>
              Updated {dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString() : "—"}
            </Typography>
            <Typography variant="h6" fontFamily="monospace" sx={{ opacity: 0.85 }}>
              {now.toLocaleTimeString()}
            </Typography>
          </Stack>
        </Stack>

        {!isLoading && activeStages.length > 1 && (
          <Box sx={{ height: 3, bgcolor: "rgba(255,255,255,0.06)", position: "relative", overflow: "hidden" }}>
            <Box
              key={currentStage}
              sx={{
                position: "absolute",
                inset: 0,
                bgcolor: EPIROC_YELLOW,
                transformOrigin: "left",
                "@keyframes board-progress": {
                  from: { transform: "scaleX(1)" },
                  to: { transform: "scaleX(0)" },
                },
                animation: `board-progress ${STAGE_DURATION_MS}ms linear forwards`,
              }}
            />
          </Box>
        )}

        <Stack direction="row" spacing={1.5} sx={{ px: 3, py: 2, flexShrink: 0 }}>
          {COLUMNS.map((stage) => {
            const count = byStage.get(stage)?.length ?? 0;
            const isActive = stage === currentStage;
            return (
              <Box
                key={stage}
                sx={{
                  flex: 1,
                  textAlign: "center",
                  py: 1,
                  borderRadius: 2,
                  bgcolor: isActive ? "primary.main" : "background.paper",
                  color: isActive ? EPIROC_BLACK : "text.primary",
                  opacity: count === 0 ? 0.4 : 1,
                  transition: "background-color 0.5s ease, color 0.5s ease, opacity 0.5s ease",
                }}
              >
                <Typography variant="subtitle2" fontWeight={700}>
                  {STAGE_LABELS[stage]}
                </Typography>
                <Typography variant="caption" sx={{ opacity: 0.8 }}>
                  {count} job{count === 1 ? "" : "s"}
                </Typography>
              </Box>
            );
          })}
        </Stack>

        <Box sx={{ flex: 1, minHeight: 0, px: 3, pb: 3 }}>
          {isLoading ? (
            <Typography variant="h5" sx={{ opacity: 0.5, textAlign: "center", mt: 8 }}>
              Loading…
            </Typography>
          ) : (
            <Fade in key={currentStage ?? "empty"} timeout={600}>
              <Box sx={{ height: "100%", display: "flex", flexDirection: "column", minHeight: 0 }}>
                <Typography variant="h3" fontWeight={800} sx={{ mb: 2, color: EPIROC_YELLOW, flexShrink: 0 }}>
                  {currentStage ? STAGE_LABELS[currentStage] : "No open jobs"}
                </Typography>
                <Box
                  sx={{
                    flex: 1,
                    minHeight: 0,
                    overflowY: "auto",
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                    gap: 2,
                    alignContent: "start",
                  }}
                >
                  {currentJobs.map((job) => (
                    <BoardJobCard key={job.id} job={job} />
                  ))}
                </Box>
              </Box>
            </Fade>
          )}
        </Box>
      </Box>
    </ThemeProvider>
  );
}
