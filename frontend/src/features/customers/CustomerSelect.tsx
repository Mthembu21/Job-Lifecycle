import { KeyboardEvent, useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Plus, Search } from "lucide-react";
import { apiErrorMessage } from "../../api/client";
import {
  customerGroupOf,
  customerMatchKey,
  existingCustomerOf,
  normalizeCustomerName,
  useCreateCustomer,
  useCustomers,
} from "../../api/customers";
import { cn } from "../../components/ui";

interface CustomerSelectProps {
  value: string;
  onChange: (name: string) => void;
  label?: string;
  required?: boolean;
  error?: string;
  className?: string;
  /** Show "Add customer" when the search finds nothing (people who can add customers). */
  allowAdd?: boolean;
}

/**
 * Pick a customer from the customer list: type to search, arrows + Enter to choose. When the name
 * isn't on the list, "Add customer" saves it (in capitals) — unless it's already there under the
 * same name or a near-copy ("IVAN PLATS" for IVANPLATS), in which case that customer is offered.
 */
export function CustomerSelect({ value, onChange, label = "Customer", required, error, className, allowAdd = true }: CustomerSelectProps) {
  const { data: customers = [], isLoading } = useCustomers();
  const createCustomer = useCreateCustomer();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [addError, setAddError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const inputId = useId();

  const matches = useMemo(() => {
    const q = normalizeCustomerName(query);
    const qKey = customerMatchKey(query);
    if (!q) return customers;
    // A SASOL site ("Sasol Shondoni") finds SASOL itself.
    const group = customerGroupOf(query);
    return customers.filter((c) => c.name.includes(q) || (qKey && customerMatchKey(c.name).includes(qKey)) || c.name === group);
  }, [customers, query]);

  const typed = normalizeCustomerName(query);
  const sameAsExisting = customers.find((c) => customerMatchKey(c.name) === customerMatchKey(customerGroupOf(typed) ?? typed));
  const canAdd = allowAdd && typed.length >= 2 && !sameAsExisting;
  // Options = matches, then the "Add" row.
  const optionCount = matches.length + (canAdd ? 1 : 0);

  useEffect(() => setActive(0), [query]);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  function choose(name: string) {
    onChange(name);
    setQuery("");
    setOpen(false);
    setAddError(null);
  }

  async function add() {
    setAddError(null);
    try {
      const created = await createCustomer.mutateAsync(typed);
      choose(created.name);
    } catch (err) {
      const existing = existingCustomerOf(err);
      if (existing) choose(existing.name);
      else setAddError(apiErrorMessage(err, "Could not add the customer"));
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(a + 1, optionCount - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      if (!open) return;
      e.preventDefault();
      if (active < matches.length) choose(matches[active].name);
      else if (canAdd) add();
    } else if (e.key === "Escape") {
      setOpen(false);
      setQuery("");
    }
  }

  const describedBy = error || addError ? `${inputId}-help` : undefined;

  return (
    <div ref={rootRef} className={cn("relative flex min-w-0 flex-col gap-1.5", className)}>
      <label htmlFor={inputId} className="text-xs font-semibold tracking-wide text-gray-700 dark:text-gray-300">
        {label}
        {required && <span className="ml-0.5 text-danger">*</span>}
      </label>
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-gray-400" />
        <input
          ref={inputRef}
          id={inputId}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-invalid={!!error || undefined}
          aria-describedby={describedBy}
          autoComplete="off"
          placeholder={value ? "" : isLoading ? "Loading customers…" : "Search customers"}
          value={open ? query : value}
          onFocus={() => {
            setOpen(true);
            setQuery("");
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onKeyDown={onKeyDown}
          className={cn(
            "h-10 w-full rounded-lg border bg-white pr-9 pl-9 text-sm text-gray-900 uppercase outline-none transition-colors placeholder:normal-case placeholder:text-gray-400 focus:border-yellow focus:ring-4 focus:ring-yellow/30 dark:bg-gray-800 dark:text-gray-100",
            error ? "border-danger" : "border-gray-300 hover:border-gray-400 dark:border-gray-600"
          )}
        />
        <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-gray-500" />
      </div>

      {open && (
        <ul
          id={listId}
          role="listbox"
          className="absolute top-full z-40 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-gray-200 bg-white py-1 text-sm shadow-lg dark:border-gray-700 dark:bg-gray-900"
        >
          {matches.map((c, i) => (
            <li
              key={c.id}
              role="option"
              aria-selected={c.name === value}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(c.name)}
              onMouseEnter={() => setActive(i)}
              className={cn(
                "flex cursor-pointer items-center justify-between gap-2 px-3 py-2",
                i === active && "bg-yellow-soft dark:bg-yellow/10"
              )}
            >
              <span className="truncate">{c.name}</span>
              {c.name === value && <Check className="size-4 shrink-0 text-gray-700 dark:text-gray-200" />}
            </li>
          ))}
          {matches.length === 0 && !canAdd && (
            <li className="px-3 py-2 text-gray-500 dark:text-gray-400">
              {sameAsExisting ? `Already on the list as ${sameAsExisting.name}` : "No customers found"}
            </li>
          )}
          {canAdd && (
            <li
              role="option"
              aria-selected={false}
              onMouseDown={(e) => e.preventDefault()}
              onClick={add}
              onMouseEnter={() => setActive(matches.length)}
              className={cn(
                "flex cursor-pointer items-center gap-2 border-t border-gray-100 px-3 py-2 font-semibold dark:border-gray-800",
                active === matches.length && "bg-yellow-soft dark:bg-yellow/10"
              )}
            >
              <Plus className="size-4 shrink-0" />
              {createCustomer.isPending ? "Adding…" : `Add “${typed}” as a new customer`}
            </li>
          )}
        </ul>
      )}

      {(error || addError) && (
        <p id={describedBy} className="text-xs text-danger">
          {addError ?? error}
        </p>
      )}
    </div>
  );
}
