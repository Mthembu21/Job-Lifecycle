import { useState } from "react";
import { dateWarningsOf } from "../../api/client";

/**
 * The "dates look out of order — save anyway?" step every job form shares. The server checks the
 * dates (lib/dateRules.ts) and answers 409 with the warnings; the form shows them, the Save button
 * becomes "Save anyway", and the next save is sent with `confirmDateWarnings: true`.
 */
export function useDateWarnings() {
  const [dateWarnings, setDateWarnings] = useState<string[] | null>(null);

  return {
    dateWarnings,
    /** Adds the confirmation to a payload once the user has seen the warnings. */
    withConfirmation<T extends object>(payload: T): T & { confirmDateWarnings?: true } {
      return dateWarnings ? { ...payload, confirmDateWarnings: true } : payload;
    },
    /** True (and the warnings are shown) when the error was the date-warning response. */
    handleError(err: unknown): boolean {
      const warnings = dateWarningsOf(err);
      if (warnings) setDateWarnings(warnings);
      return Boolean(warnings);
    },
    saveLabel: dateWarnings ? "Save anyway" : undefined,
  };
}
