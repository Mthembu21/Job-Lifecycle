import { ReactNode } from "react";
import { Alert, Button, Dialog } from "./ui";

/** Shared destructive-confirmation dialog used by the job / bulk / stage delete flows. */
export function ConfirmDeleteDialog({
  title,
  children,
  error,
  pending,
  onConfirm,
  onClose,
}: {
  title: string;
  children: ReactNode;
  error: string | null;
  pending: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog
      size="xs"
      title={title}
      onClose={onClose}
      actions={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button variant="danger" onClick={onConfirm} loading={pending}>
            {pending ? "Deleting…" : "Delete"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {error && <Alert severity="error">{error}</Alert>}
        <p className="leading-relaxed">{children}</p>
      </div>
    </Dialog>
  );
}
