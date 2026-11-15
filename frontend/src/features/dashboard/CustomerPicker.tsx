import { CustomerOption } from "../../api/dashboard";
import { TextField } from "../../components/ui";

/** Narrows the dashboard to one customer's jobs ("All customers" = the whole workshop). */
export function CustomerPicker({
  value,
  options,
  onChange,
}: {
  value: string | null;
  options: CustomerOption[];
  onChange: (key: string | null) => void;
}) {
  return (
    <TextField
      select
      size="sm"
      label="Customer"
      className="w-56"
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value || null)}
    >
      <option value="">All customers</option>
      {options.map((c) => (
        <option key={c.key} value={c.key}>
          {c.name}
        </option>
      ))}
    </TextField>
  );
}
