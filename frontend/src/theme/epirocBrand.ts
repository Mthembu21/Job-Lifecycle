/**
 * Epiroc palette for places that need raw hex values (charts). Mirrors the
 * @theme block in src/index.css — keep both in sync. Epiroc has no black;
 * the gray scale is built around the logo slate (#415464 = 800).
 */
export const EPIROC_YELLOW = "#FFCE00";

export const EPIROC_GRAY = {
  50: "#F5F7F8",
  100: "#EBEEF0",
  200: "#D9DEE2",
  300: "#BCC5CC",
  400: "#94A1AB",
  500: "#758591",
  600: "#5B6B78",
  700: "#4A5C6A",
  800: "#415464",
  900: "#2F3E4A",
  950: "#24313B",
} as const;

export const STATUS_SUCCESS = "#2E8540";
export const STATUS_DANGER = "#C4372C";
