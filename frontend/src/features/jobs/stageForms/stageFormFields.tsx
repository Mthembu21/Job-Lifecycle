import { Control, Controller, FieldValues, Path } from "react-hook-form";
import { TextField } from "../../../components/ui";

/**
 * Turns stage form values into the API payload: empty fields are left out (so they aren't
 * overwritten), the listed number fields are sent as numbers, and `omit` fields are dropped.
 */
export function toStagePayload(
  values: object,
  { numbers = [], omit = [] }: { numbers?: string[]; omit?: string[] } = {}
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(values)) {
    if (value === "" || omit.includes(key)) continue;
    payload[key] = numbers.includes(key) ? Number(value) : value;
  }
  return payload;
}

/** Delay reason textarea that becomes mandatory once the server reports an SLA breach. */
export function DelayReasonField<T extends FieldValues>({
  control,
  name,
  required,
  requiredText,
  optionalText,
}: {
  control: Control<T>;
  name: Path<T>;
  required: boolean;
  requiredText: string;
  optionalText: string;
}) {
  return (
    <Controller
      name={name}
      control={control}
      rules={{ required }}
      render={({ field, fieldState }) => (
        <TextField
          {...field}
          className="sm:col-span-2"
          label="Delay Reason"
          multiline
          required={required}
          error={!!fieldState.error}
          helperText={required ? requiredText : optionalText}
        />
      )}
    />
  );
}
