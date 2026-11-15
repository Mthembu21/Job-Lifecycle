/*
 * Customer names — one rule everywhere a name is entered or compared (Create Job, the customer
 * list, the Excel import, the dashboard):
 *  - stored in capitals with single spaces ("  Sasol   thubelisha " → "SASOL THUBELISHA");
 *  - two names that only differ by spaces or punctuation are the same customer
 *    ("IVAN PLATS" = "IVANPLATS"), so a near-copy can't be added as a new customer.
 */

/** The stored form of a customer name: trimmed, single-spaced, capitals. */
export function normalizeCustomerName(name: string | null | undefined): string {
  return (name ?? "").trim().replace(/\s+/g, " ").toUpperCase();
}

/** What makes two names the same customer: letters and digits only. */
export function customerMatchKey(name: string | null | undefined): string {
  return normalizeCustomerName(name).replace(/[^A-Z0-9]/g, "");
}

/**
 * Customers recorded as one, whatever site follows the name: "SASOL IMPUMELELO", "Sasol-Shondoni"
 * … are all SASOL (decided 2026-11-15). Mirrored in frontend/src/api/customers.ts.
 */
export const SINGLE_CUSTOMER_GROUPS = ["SASOL"];

/** The group a name belongs to ("SASOL SHONDONI" → "SASOL"), or null. */
export function customerGroupOf(name: string | null | undefined): string | null {
  const key = customerMatchKey(name);
  return SINGLE_CUSTOMER_GROUPS.find((group) => key.startsWith(customerMatchKey(group))) ?? null;
}

/** The existing customer a name refers to (exact, near-copy, or a site of a single-customer group), if any. */
export function findMatchingCustomer<T extends { name: string }>(name: string, customers: T[]): T | undefined {
  const group = customerGroupOf(name);
  const key = customerMatchKey(group ?? name);
  return key ? customers.find((c) => customerMatchKey(c.name) === key) : undefined;
}

/** Why a new customer name can't be used, or null when it's fine. */
export function customerNameProblem(name: string): string | null {
  const normalized = normalizeCustomerName(name);
  if (normalized.length < 2) return "Enter the customer's name";
  if (normalized.length > 80) return "Customer name is too long (80 characters at most)";
  if (!/[A-Z]/.test(normalized)) return "Customer name must contain letters";
  const group = customerGroupOf(normalized);
  if (group && normalized !== group) return `All ${group} sites are one customer — use ${group}`;
  return null;
}
