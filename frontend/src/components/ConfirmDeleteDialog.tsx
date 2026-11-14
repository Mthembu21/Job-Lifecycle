import { ReactNode } from "react";
import { UseMutationResult } from "@tanstack/react-query";
import { apiErrorMessage } from "../api/client";
import { Alert, Button, Dialog } from "./ui";

/**
 * Shared destructive-confirmation dialog for the job / bulk / stage delete flows. It runs the
 * given mutation and shows the API's error message if it fails.
 */
export function ConfirmDeleteDialog<TVariables>({
  title,
  children,
  mutation,
  variables,
  errorFallback,
  onDeleted,
  onClose,
}: {
  title: string;
  children: ReactNode;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mutation: UseMutationResult<any, unknown, TVariables>;
  variables: TVariables;
  errorFallback: string;
  /** Called after a successful delete (defaults to closing the dialog). */
  onDeleted?: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog
      size="xs"
      title={title}
      onClose={onClose}
      actions={
        <>
          <Button variant="ghost" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={() => mutation.mutate(variables, { onSuccess: onDeleted ?? onClose })}
            loading={mutation.isPending}
          >
            {mutation.isPending ? "Deleting…" : "Delete"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {mutation.isError && <Alert severity="error">{apiErrorMessage(mutation.error, errorFallback)}</Alert>}
        <p className="leading-relaxed">{children}</p>
      </div>
    </Dialog>
  );
}
