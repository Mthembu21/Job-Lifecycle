import { ReactNode } from "react";
import { Control, Controller, FieldValues, Path } from "react-hook-form";
import { Alert, Button, Dialog, TextField } from "../../../components/ui";

/** Shared chrome for the quotation / repair / dispatch / invoice stage forms. */
export function StageFormDialog({
  title,
  error,
  warning,
  submitting,
  saveDisabled,
  onSave,
  onClose,
  children,
}: {
  title: string;
  error: string | null;
  warning?: string | null;
  submitting: boolean;
  saveDisabled?: boolean;
  onSave: () => void;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <Dialog
      title={title}
      onClose={onClose}
      actions={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={onSave} loading={submitting} disabled={saveDisabled}>
            {submitting ? "Saving…" : "Save"}
          </Button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!saveDisabled) onSave();
        }}
        className="grid grid-cols-1 gap-4 sm:grid-cols-2"
      >
        {warning && (
          <Alert severity="warning" className="sm:col-span-2">
            {warning}
          </Alert>
        )}
        {error && (
          <Alert severity="error" className="sm:col-span-2">
            {error}
          </Alert>
        )}
        {children}
      </form>
    </Dialog>
  );
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
