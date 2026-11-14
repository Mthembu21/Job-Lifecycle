import { Search } from "lucide-react";
import { JobFilters } from "../../api/jobs";
import { JOB_TYPE_LABELS, PRIORITY_LABELS, STAGE_LABELS, STAGE_STATUS_LABELS } from "../../constants";
import { Button, Card, TextField } from "../../components/ui";

interface FilterBarProps {
  filters: JobFilters;
  onChange: (filters: JobFilters) => void;
}

function Options({ labels }: { labels: Record<string, string> }) {
  return (
    <>
      <option value="">All</option>
      {Object.entries(labels).map(([value, label]) => (
        <option key={value} value={value}>
          {label}
        </option>
      ))}
    </>
  );
}

export function FilterBar({ filters, onChange }: FilterBarProps) {
  function set<K extends keyof JobFilters>(key: K, value: JobFilters[K]) {
    onChange({ ...filters, [key]: value || undefined });
  }
  const hasFilters = Object.values(filters).some(Boolean);

  return (
    <Card className="mb-4 p-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-[minmax(240px,2fr)_repeat(7,minmax(0,1fr))]">
        <div className="relative col-span-2 sm:col-span-4 xl:col-span-1">
          <TextField
            label="Search"
            size="sm"
            placeholder="Reference, customer, serial, description"
            value={filters.search ?? ""}
            onChange={(e) => set("search", e.target.value)}
            className="[&_input]:pl-9"
          />
          <Search className="pointer-events-none absolute bottom-2.5 left-3 size-4 text-gray-400" />
        </div>
        <TextField select label="Service Type" size="sm" value={filters.jobType ?? ""} onChange={(e) => set("jobType", e.target.value as JobFilters["jobType"])}>
          <Options labels={JOB_TYPE_LABELS} />
        </TextField>
        <TextField select label="Priority" size="sm" value={filters.priority ?? ""} onChange={(e) => set("priority", e.target.value as JobFilters["priority"])}>
          <Options labels={PRIORITY_LABELS} />
        </TextField>
        <TextField select label="Stage" size="sm" value={filters.stage ?? ""} onChange={(e) => set("stage", e.target.value as JobFilters["stage"])}>
          <Options labels={STAGE_LABELS} />
        </TextField>
        <TextField select label="Status" size="sm" value={filters.status ?? ""} onChange={(e) => set("status", e.target.value as JobFilters["status"])}>
          <Options labels={STAGE_STATUS_LABELS} />
        </TextField>
        <TextField select label="WO Number" size="sm" value={filters.missingWo ?? ""} onChange={(e) => set("missingWo", e.target.value as JobFilters["missingWo"])}>
          <option value="">All</option>
          <option value="true">Missing WO</option>
        </TextField>
        <TextField
          label="Created From"
          type="date"
          size="sm"
          value={filters.createdFrom ?? ""}
          onChange={(e) => set("createdFrom", e.target.value)}
        />
        <TextField
          label="Created To"
          type="date"
          size="sm"
          value={filters.createdTo ?? ""}
          onChange={(e) => set("createdTo", e.target.value)}
        />
      </div>
      {hasFilters && (
        <div className="mt-3 flex justify-end">
          <Button size="sm" variant="ghost" onClick={() => onChange({})}>
            Clear filters
          </Button>
        </div>
      )}
    </Card>
  );
}
