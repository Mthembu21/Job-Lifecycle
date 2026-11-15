import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Pencil, Plus, Search } from "lucide-react";
import { apiErrorMessage } from "../../api/client";
import {
  Customer,
  customerMatchKey,
  existingCustomerOf,
  normalizeCustomerName,
  useCreateCustomer,
  useCustomers,
  useRenameCustomer,
} from "../../api/customers";
import { useAuth } from "../../auth/AuthContext";
import { canAddCustomer, canRenameCustomer } from "../../auth/permissions";
import { Alert, Button, Card, IconButton, PageHeader, PageSpinner, TextField, cn } from "../../components/ui";
import { EmptyRow, STICKY_THEAD, TD, TH } from "../../components/ui/Table";
import { FormDialog } from "../../components/FormDialog";

/** The customer list: search it, add customers, and (planners / admins) correct a customer's name everywhere. */
export function CustomersPage() {
  const { user } = useAuth();
  const { data: customers, isLoading } = useCustomers();
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);
  const [renaming, setRenaming] = useState<Customer | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const shown = useMemo(() => {
    const q = normalizeCustomerName(search);
    const key = customerMatchKey(search);
    return (customers ?? []).filter((c) => !q || c.name.includes(q) || (key && customerMatchKey(c.name).includes(key)));
  }, [customers, search]);

  if (isLoading || !customers) return <PageSpinner />;

  return (
    <div className="max-w-3xl">
      <PageHeader title="Customers" subtitle="Every job is created against a customer on this list — names are kept in capitals, one entry per customer.">
        {canAddCustomer(user?.role) && (
          <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setAdding(true)}>
            Add customer
          </Button>
        )}
      </PageHeader>

      {notice && (
        <Alert severity="success" className="mb-4">
          {notice}
        </Alert>
      )}

      <Card className="p-4">
        <div className="relative mb-3">
          <TextField label="Search" hideLabel size="sm" placeholder="Search customers" value={search} onChange={(e) => setSearch(e.target.value)} className="[&_input]:pl-9" />
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-gray-400" />
        </div>
        <div className="overflow-auto rounded-lg border border-gray-200 dark:border-gray-800">
          <table className="w-full text-sm">
            <thead className={STICKY_THEAD}>
              <tr>
                <th className={TH}>Customer</th>
                <th className={cn(TH, "text-right")}>Jobs</th>
                <th className={cn(TH, "w-12")} />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {shown.length === 0 && <EmptyRow cols={3}>No customers match “{search}”.</EmptyRow>}
              {shown.map((c) => (
                <tr key={c.id}>
                  <td className={cn(TD, "font-semibold")}>{c.name}</td>
                  <td className={cn(TD, "text-right tabular-nums")}>
                    {c.jobCount > 0 ? (
                      <Link to={`/jobs?${new URLSearchParams({ customerKey: c.name })}`} className="underline decoration-yellow decoration-2 underline-offset-4">
                        {c.jobCount}
                      </Link>
                    ) : (
                      0
                    )}
                  </td>
                  <td className={cn(TD, "text-right")}>
                    {canRenameCustomer(user?.role) && (
                      <IconButton size="sm" label={`Rename ${c.name}`} onClick={() => setRenaming(c)}>
                        <Pencil />
                      </IconButton>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          {customers.length} customers. Click a job count to see that customer's jobs.
        </p>
      </Card>

      {adding && (
        <CustomerNameDialog
          title="Add customer"
          onClose={() => setAdding(false)}
          onSaved={(name) => setNotice(`${name} was added to the customer list.`)}
        />
      )}
      {renaming && (
        <CustomerNameDialog
          title={`Rename ${renaming.name}`}
          customer={renaming}
          onClose={() => setRenaming(null)}
          onSaved={(name, jobsUpdated) =>
            setNotice(`${renaming.name} is now ${name}${jobsUpdated ? ` — ${jobsUpdated} job${jobsUpdated === 1 ? "" : "s"} updated` : ""}.`)
          }
        />
      )}
    </div>
  );
}

/** Add a customer, or rename one (with the jobs that carry its name). */
function CustomerNameDialog({
  title,
  customer,
  onClose,
  onSaved,
}: {
  title: string;
  customer?: Customer;
  onClose: () => void;
  onSaved: (name: string, jobsUpdated?: number) => void;
}) {
  const create = useCreateCustomer();
  const rename = useRenameCustomer();
  const [name, setName] = useState(customer?.name ?? "");
  const [error, setError] = useState<string | null>(null);
  const preview = normalizeCustomerName(name);

  async function save() {
    setError(null);
    try {
      if (customer) {
        const result = await rename.mutateAsync({ id: customer.id, name });
        onSaved(result.name, result.jobsUpdated);
      } else {
        const created = await create.mutateAsync(name);
        onSaved(created.name);
      }
      onClose();
    } catch (err) {
      const existing = existingCustomerOf(err);
      setError(
        existing
          ? `${existing.name} is already on the customer list${customer ? " — two customers can't share a name" : ""}.`
          : apiErrorMessage(err, "Could not save the customer")
      );
    }
  }

  return (
    <FormDialog
      size="xs"
      columns={1}
      title={title}
      error={error}
      submitting={create.isPending || rename.isPending}
      saveDisabled={preview.length < 2 || preview === customer?.name}
      onSave={save}
      onClose={onClose}
    >
      <TextField
        autoFocus
        label="Customer name"
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="[&_input]:uppercase"
        helperText={preview && preview !== name ? `Will be saved as ${preview}` : "Saved in capitals"}
      />
      {customer && customer.jobCount > 0 && (
        <Alert severity="info">
          All {customer.jobCount} job{customer.jobCount === 1 ? "" : "s"} for {customer.name} will move to the new name. Each
          job's history records the change.
        </Alert>
      )}
    </FormDialog>
  );
}
