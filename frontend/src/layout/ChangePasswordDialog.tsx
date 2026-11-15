import { FormEvent, useState } from "react";
import { apiErrorMessage } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { Alert, Button, Dialog, TextField } from "../components/ui";

const MIN_LENGTH = 12;

export function ChangePasswordDialog({ onClose }: { onClose: () => void }) {
  const { changePassword } = useAuth();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const mismatch = confirm.length > 0 && confirm !== next;
  const tooShort = next.length > 0 && next.length < MIN_LENGTH;
  const canSubmit = current.length > 0 && next.length >= MIN_LENGTH && next === confirm;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    try {
      await changePassword(current, next);
      setDone(true);
    } catch (err) {
      setError(apiErrorMessage(err, "Could not change the password"));
    } finally {
      setSaving(false);
    }
  }

  if (done) {
    return (
      <Dialog
        size="xs"
        title="Password changed"
        onClose={onClose}
        actions={
          <Button variant="primary" onClick={onClose}>
            Done
          </Button>
        }
      >
        <Alert severity="success">
          Your password has been changed. Any other devices signed in to this account have been signed out.
        </Alert>
      </Dialog>
    );
  }

  return (
    <Dialog
      size="xs"
      title="Change password"
      onClose={onClose}
      actions={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="change-password" loading={saving} disabled={!canSubmit}>
            Change password
          </Button>
        </>
      }
    >
      <form id="change-password" onSubmit={submit} className="flex flex-col gap-4">
        {error && <Alert severity="error">{error}</Alert>}
        <TextField
          label="Current password"
          type="password"
          autoComplete="current-password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          required
          autoFocus
        />
        <TextField
          label="New password"
          type="password"
          autoComplete="new-password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          error={tooShort}
          helperText={`At least ${MIN_LENGTH} characters. A few unrelated words make a strong, memorable password.`}
          required
        />
        <TextField
          label="Confirm new password"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          error={mismatch}
          helperText={mismatch ? "Doesn't match the new password" : undefined}
          required
        />
      </form>
    </Dialog>
  );
}
