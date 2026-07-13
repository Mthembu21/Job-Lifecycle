export type ThemeMode = "light" | "dark";

/**
 * Chart-only color tokens, validated with the dataviz skill's palette validator
 * (worst adjacent CVD ΔE 24.2 light / 10.3 dark). Fixed slot order is the
 * CVD-safety mechanism — never reassign or cycle these per filter/selection.
 */
const CATEGORICAL: Record<ThemeMode, string[]> = {
  light: ["#2a78d6", "#1baf7a", "#eda100", "#008300", "#4a3aa7", "#e34948", "#e87ba4", "#eb6834"],
  dark: ["#3987e5", "#199e70", "#c98500", "#008300", "#9085e9", "#e66767", "#d55181", "#d95926"],
};

/** Reserved for SLA/status state only — never reused as a categorical series color. */
const STATUS: Record<ThemeMode, { good: string; warning: string; critical: string }> = {
  light: { good: "#0ca30c", warning: "#fab219", critical: "#d03b3b" },
  dark: { good: "#0ca30c", warning: "#fab219", critical: "#d03b3b" },
};

/** Single-hue sequential ramp (blue), light -> dark, for magnitude encodings. */
const SEQUENTIAL_BLUE: Record<ThemeMode, string[]> = {
  light: ["#cde2fb", "#9ec5f4", "#5598e7", "#2a78d6", "#184f95"],
  dark: ["#cde2fb", "#6da7ec", "#3987e5", "#1c5cab", "#0d366b"],
};

export function getCategoricalPalette(mode: ThemeMode): string[] {
  return CATEGORICAL[mode];
}

export function getStatusPalette(mode: ThemeMode) {
  return STATUS[mode];
}

export function getSequentialBluePalette(mode: ThemeMode): string[] {
  return SEQUENTIAL_BLUE[mode];
}
