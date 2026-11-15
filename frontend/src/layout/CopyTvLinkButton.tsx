import { useState } from "react";
import { Check, Link2 } from "lucide-react";
import { apiClient } from "../api/client";

type State = "idle" | "copied" | "missing" | "error";

const LABEL: Record<State, string> = {
  idle: "Copy TV screen link",
  copied: "TV link copied",
  missing: "TV link not set up",
  error: "Couldn't copy link",
};

/**
 * Copies the TV screen link (/board?key=…) for setting up the meeting-room screen, which runs
 * without anyone signed in. Admin only; the key isn't shown anywhere else in the app.
 */
export function CopyTvLinkButton({ className }: { className?: string }) {
  const [state, setState] = useState<State>("idle");

  async function copy() {
    try {
      const { data } = await apiClient.get<{ key: string | null }>("/board/link");
      if (!data.key) {
        setState("missing");
        return;
      }
      await navigator.clipboard.writeText(`${window.location.origin}/board?key=${encodeURIComponent(data.key)}`);
      setState("copied");
      setTimeout(() => setState("idle"), 2500);
    } catch {
      setState("error");
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className={className}
      title={state === "missing" ? "Set BOARD_ACCESS_KEY in backend/.env" : "For the meeting-room screen. Keep it private."}
    >
      {state === "copied" ? <Check className="size-5 shrink-0" /> : <Link2 className="size-5 shrink-0" />}
      <span className="truncate">{LABEL[state]}</span>
    </button>
  );
}
