import { Alert } from "../../components/ui";

/** The list of out-of-order dates the server found, shown above a form before "Save anyway". */
export function DateWarningsAlert({ warnings, className }: { warnings: string[] | null; className?: string }) {
  if (!warnings) return null;
  return (
    <Alert severity="warning" className={className}>
      <p className="font-semibold">Some dates look out of order — please check them:</p>
      <ul className="mt-1 list-disc pl-5">
        {warnings.map((w) => (
          <li key={w}>{w}</li>
        ))}
      </ul>
      <p className="mt-1">Correct the dates, or choose “Save anyway” if they're right.</p>
    </Alert>
  );
}
