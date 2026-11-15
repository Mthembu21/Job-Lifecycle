import axios from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "./client";

export interface Customer {
  id: string;
  /** Always capitals, single spaces (the server stores it that way). */
  name: string;
  jobCount: number;
}

/** The customer list, A–Z. */
export function useCustomers() {
  return useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const { data } = await apiClient.get<Customer[]>("/customers");
      return data;
    },
    staleTime: 60_000,
  });
}

/** The customer a 409 "already on the list" answer points to, if that's what the error is. */
export function existingCustomerOf(err: unknown): { id: string; name: string } | null {
  if (!axios.isAxiosError<{ existing?: { id: string; name: string } }>(err) || err.response?.status !== 409) return null;
  return err.response.data?.existing ?? null;
}

/**
 * A 409 "looks like a typo of a customer already on the list" answer: the look-alike customers,
 * and whether this user may confirm it's a different customer (planners / admins).
 */
export function similarCustomersOf(err: unknown): { similar: { id: string; name: string }[]; canOverride: boolean } | null {
  if (!axios.isAxiosError<{ similar?: { id: string; name: string }[]; canOverride?: boolean }>(err) || err.response?.status !== 409) return null;
  const similar = err.response.data?.similar;
  return similar?.length ? { similar, canOverride: err.response.data?.canOverride === true } : null;
}

/** `confirmSimilar`: "it's a different customer, not a typo" (planners / admins only). */
export interface CustomerNameInput {
  name: string;
  confirmSimilar?: boolean;
}

export function useCreateCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CustomerNameInput) => {
      const { data } = await apiClient.post<{ id: string; name: string }>("/customers", input);
      return data;
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["customers"] }),
  });
}

/** Renames a customer — and every job carrying the name. */
export function useRenameCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: CustomerNameInput & { id: string }) => {
      const { data } = await apiClient.patch<{ id: string; name: string; jobsUpdated: number }>(`/customers/${id}`, input);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

/** Removes a customer from the list — only one with no jobs (the server refuses otherwise). */
export function useDeleteCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/customers/${id}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["customers"] }),
  });
}

/** Same rule as the server (backend lib/customers.ts): capitals, single spaces. */
export function normalizeCustomerName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toUpperCase();
}

/** Letters and digits only — two names with the same key are the same customer. */
export function customerMatchKey(name: string): string {
  return normalizeCustomerName(name).replace(/[^A-Z0-9]/g, "");
}

/** Customers recorded as one whatever site follows ("SASOL SHONDONI" is SASOL). Mirrors backend lib/customers.ts. */
export const SINGLE_CUSTOMER_GROUPS = ["SASOL"];

/** The single-customer group a name belongs to, or null. */
export function customerGroupOf(name: string): string | null {
  const key = customerMatchKey(name);
  return SINGLE_CUSTOMER_GROUPS.find((g) => key.startsWith(customerMatchKey(g))) ?? null;
}
