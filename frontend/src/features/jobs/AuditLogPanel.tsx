import { useJobAudit } from "../../api/jobs";
import { ROLE_LABELS } from "../../constants";
import { Badge, Card, CardTitle } from "../../components/ui";

export function AuditLogPanel({ jobId }: { jobId: string }) {
  const { data: logs, isLoading } = useJobAudit(jobId);

  if (isLoading) return null;

  return (
    <Card className="p-5">
      <CardTitle>Audit Trail</CardTitle>
      <div className="flex max-h-[360px] flex-col gap-4 overflow-y-auto pr-1">
        {logs?.length === 0 && <p className="text-sm text-gray-500 dark:text-gray-400">No changes recorded yet.</p>}
        {logs?.map((entry) => {
          const changes = entry.summary.includes(": ") ? entry.summary.split("; ") : null;
          return (
            <div key={entry.id} className="border-l-2 border-gray-200 pl-3 dark:border-gray-700">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <Badge>{entry.stage}</Badge>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {new Date(entry.changedAt).toLocaleString()} ·{" "}
                  {entry.changedBy.role ? ROLE_LABELS[entry.changedBy.role] : entry.changedBy.name}
                </span>
              </div>
              {changes ? (
                <ul className="list-disc space-y-0.5 pl-5 text-sm text-gray-800 dark:text-gray-200">
                  {changes.map((change, i) => (
                    <li key={i}>{change}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-800 dark:text-gray-200">{entry.summary}</p>
              )}
              {entry.comment && <p className="mt-1 text-xs text-gray-500 italic dark:text-gray-400">"{entry.comment}"</p>}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
