import { ReactNode } from "react";
import { Alert, Button, Dialog, cn } from "./ui";
import { DateWarningsAlert } from "../features/jobs/DateWarningsAlert";

/**
 * A dialog wrapping a form: Cancel / Save buttons, an error and an optional warning banner, and
 * Enter-to-save. Used by the stage forms and the small single-field dialogs.
 */
export function FormDialog({
  title,
  error,
  warning,
  dateWarnings,
  saveLabel,
  submitting,
  saveDisabled,
  onSave,
  onClose,
  size = "sm",
  columns = 2,
  extraActions,
  children,
}: {
  title: string;
  error: string | null;
  warning?: string | null;
  /** Out-of-order dates the server reported (see useDateWarnings). */
  dateWarnings?: string[] | null;
  /** Replaces "Save" — e.g. "Save anyway" once date warnings are shown. */
  saveLabel?: string;
  submitting: boolean;
  saveDisabled?: boolean;
  onSave: () => void;
  onClose: () => void;
  size?: "xs" | "sm";
  /** 2 = two-column grid on wider screens (stage forms); 1 = a single stack. */
  columns?: 1 | 2;
  /** Extra buttons placed on the left of the action bar (e.g. "Remove"). */
  extraActions?: ReactNode;
  children: ReactNode;
}) {
  const fullWidth = columns === 2 ? "sm:col-span-2" : undefined;
  return (
    <Dialog
      title={title}
      size={size}
      onClose={onClose}
      actions={
        <>
          {extraActions}
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={onSave} loading={submitting} disabled={saveDisabled}>
            {submitting ? "Saving…" : saveLabel ?? "Save"}
          </Button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!saveDisabled) onSave();
        }}
        className={cn("grid grid-cols-1 gap-4", columns === 2 && "sm:grid-cols-2")}
      >
        {warning && (
          <Alert severity="warning" className={fullWidth}>
            {warning}
          </Alert>
        )}
        <DateWarningsAlert warnings={dateWarnings ?? null} className={fullWidth} />
        {error && (
          <Alert severity="error" className={fullWidth}>
            {error}
          </Alert>
        )}
        {children}
      </form>
    </Dialog>
  );
}
