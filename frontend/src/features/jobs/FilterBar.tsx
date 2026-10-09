import { Card, Grid, MenuItem, TextField } from "@mui/material";
import { JobFilters } from "../../api/jobs";
import { JOB_TYPE_LABELS, PRIORITY_LABELS, STAGE_LABELS, STAGE_STATUS_LABELS } from "../../constants";

interface FilterBarProps {
  filters: JobFilters;
  onChange: (filters: JobFilters) => void;
}

export function FilterBar({ filters, onChange }: FilterBarProps) {
  function set<K extends keyof JobFilters>(key: K, value: JobFilters[K]) {
    onChange({ ...filters, [key]: value || undefined });
  }

  return (
    <Card variant="outlined" sx={{ p: 2, mb: 2 }}>
      <Grid container spacing={2}>
        <Grid item xs={12} sm={6} md={3}>
          <TextField
            label="Search (reference, customer, serial, description)"
            fullWidth
            size="small"
            value={filters.search ?? ""}
            onChange={(e) => set("search", e.target.value)}
          />
        </Grid>
        <Grid item xs={6} sm={3} md={2}>
          <TextField
            select
            label="Job Type"
            fullWidth
            size="small"
            value={filters.jobType ?? ""}
            onChange={(e) => set("jobType", e.target.value)}
          >
            <MenuItem value="">All</MenuItem>
            {Object.entries(JOB_TYPE_LABELS).map(([value, label]) => (
              <MenuItem key={value} value={value}>
                {label}
              </MenuItem>
            ))}
          </TextField>
        </Grid>
        <Grid item xs={6} sm={3} md={2}>
          <TextField
            select
            label="Priority"
            fullWidth
            size="small"
            value={filters.priority ?? ""}
            onChange={(e) => set("priority", e.target.value)}
          >
            <MenuItem value="">All</MenuItem>
            {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
              <MenuItem key={value} value={value}>
                {label}
              </MenuItem>
            ))}
          </TextField>
        </Grid>
        <Grid item xs={6} sm={3} md={2}>
          <TextField
            select
            label="Stage"
            fullWidth
            size="small"
            value={filters.stage ?? ""}
            onChange={(e) => set("stage", e.target.value)}
          >
            <MenuItem value="">All</MenuItem>
            {Object.entries(STAGE_LABELS).map(([value, label]) => (
              <MenuItem key={value} value={value}>
                {label}
              </MenuItem>
            ))}
          </TextField>
        </Grid>
        <Grid item xs={6} sm={3} md={2}>
          <TextField
            select
            label="Status"
            fullWidth
            size="small"
            value={filters.status ?? ""}
            onChange={(e) => set("status", e.target.value)}
          >
            <MenuItem value="">All</MenuItem>
            {Object.entries(STAGE_STATUS_LABELS).map(([value, label]) => (
              <MenuItem key={value} value={value}>
                {label}
              </MenuItem>
            ))}
          </TextField>
        </Grid>
        <Grid item xs={6} sm={3} md={2}>
          <TextField
            select
            label="WO Number"
            fullWidth
            size="small"
            value={filters.missingWo ?? ""}
            onChange={(e) => set("missingWo", e.target.value)}
          >
            <MenuItem value="">All</MenuItem>
            <MenuItem value="true">Missing WO</MenuItem>
          </TextField>
        </Grid>
        <Grid item xs={6} sm={4} md={1.5}>
          <TextField
            label="Created From"
            type="date"
            fullWidth
            size="small"
            InputLabelProps={{ shrink: true }}
            value={filters.createdFrom ?? ""}
            onChange={(e) => set("createdFrom", e.target.value)}
          />
        </Grid>
        <Grid item xs={6} sm={4} md={1.5}>
          <TextField
            label="Created To"
            type="date"
            fullWidth
            size="small"
            InputLabelProps={{ shrink: true }}
            value={filters.createdTo ?? ""}
            onChange={(e) => set("createdTo", e.target.value)}
          />
        </Grid>
      </Grid>
    </Card>
  );
}
