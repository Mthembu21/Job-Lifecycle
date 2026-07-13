import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import { useJobs, JobFilters } from "../../api/jobs";
import { FilterBar } from "./FilterBar";
import { SlaChip } from "../common/SlaChip";
import { StageStatusChip } from "../common/StageStatusChip";
import { JOB_TYPE_LABELS, PRIORITY_LABELS, STAGE_LABELS } from "../../constants";
import { useAuth } from "../../auth/AuthContext";
import { canCreateJob, canDeleteJob } from "../../auth/permissions";
import { Job } from "../../types";
import { formatCurrency } from "../../utils/currency";
import { DeleteJobDialog } from "./DeleteJobDialog";

const PRIORITY_COLOR: Record<string, "error" | "warning" | "default"> = {
  HIGH: "error",
  MEDIUM: "warning",
  LOW: "default",
};

function currentStageSla(job: Job) {
  if (job.status.isClosed) return null;
  return job.status.stages.find((s) => s.name === job.status.currentStage)?.sla ?? null;
}

export function JobListPage() {
  const [filters, setFilters] = useState<JobFilters>({});
  const { data: jobs, isLoading } = useJobs(filters);
  const { user } = useAuth();
  const navigate = useNavigate();
  const [deletingJob, setDeletingJob] = useState<Job | null>(null);

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h5" fontWeight={700}>
          Jobs
        </Typography>
        {canCreateJob(user?.role) && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate("/jobs/new")}>
            New Job
          </Button>
        )}
      </Stack>

      <FilterBar filters={filters} onChange={setFilters} />

      {isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress />
        </Box>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Reference #</TableCell>
                <TableCell>Customer</TableCell>
                <TableCell>Job Type</TableCell>
                <TableCell>Priority</TableCell>
                <TableCell>Created By</TableCell>
                <TableCell>Current Stage</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>SLA</TableCell>
                <TableCell align="right">Job Age (days)</TableCell>
                <TableCell align="right">PO Value</TableCell>
                {canDeleteJob(user?.role) && <TableCell align="right">Actions</TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {jobs?.map((job) => {
                const sla = currentStageSla(job);
                return (
                  <TableRow
                    key={job.id}
                    hover
                    sx={{ cursor: "pointer" }}
                    onClick={() => navigate(`/jobs/${job.id}`)}
                  >
                    <TableCell sx={{ fontWeight: 600 }}>{job.referenceNumber}</TableCell>
                    <TableCell>{job.customer}</TableCell>
                    <TableCell>{JOB_TYPE_LABELS[job.jobType]}</TableCell>
                    <TableCell>
                      <Chip size="small" label={PRIORITY_LABELS[job.priority]} color={PRIORITY_COLOR[job.priority]} />
                    </TableCell>
                    <TableCell>{job.createdBy ? "Storeman" : "—"}</TableCell>
                    <TableCell>{STAGE_LABELS[job.status.currentStage]}</TableCell>
                    <TableCell>
                      <StageStatusChip status={job.status.currentStatus} />
                    </TableCell>
                    <TableCell>{sla ? <SlaChip status={sla.status} /> : <SlaChip status="NOT_APPLICABLE" />}</TableCell>
                    <TableCell align="right">{job.status.totalJobAge}</TableCell>
                    <TableCell align="right">
                      {formatCurrency(Number(job.poValue))}
                    </TableCell>
                    {canDeleteJob(user?.role) && (
                      <TableCell align="right">
                        <Tooltip title="Delete job">
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeletingJob(job);
                            }}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
              {jobs?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={canDeleteJob(user?.role) ? 11 : 10} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">No jobs match the current filters.</Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {deletingJob && <DeleteJobDialog job={deletingJob} onClose={() => setDeletingJob(null)} />}
    </Box>
  );
}
