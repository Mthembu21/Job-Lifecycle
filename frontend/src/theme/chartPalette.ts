import { EPIROC_GRAY, EPIROC_YELLOW, STATUS_DANGER, STATUS_SUCCESS } from "./epirocBrand";

export type ThemeMode = "light" | "dark";

/**
 * Chart series colors, Epiroc palette only. Slot 0 is Epiroc yellow, slot 1 a
 * strong gray, slot 2 a lighter gray (used for "target"/reference series).
 * Fixed slot order — never reassign per filter/selection.
 */
const CATEGORICAL: Record<ThemeMode, string[]> = {
  light: [EPIROC_YELLOW, EPIROC_GRAY[700], EPIROC_GRAY[400]],
  dark: [EPIROC_YELLOW, EPIROC_GRAY[300], EPIROC_GRAY[500]],
};

/** Reserved for SLA/status state only — never reused as a categorical series color. */
export const STATUS_COLORS = { good: STATUS_SUCCESS, warning: EPIROC_YELLOW, critical: STATUS_DANGER };

/** Axis, grid and label colors per mode. */
const CHROME: Record<ThemeMode, { axis: string; grid: string; text: string; tooltipBg: string; tooltipBorder: string }> = {
  light: { axis: EPIROC_GRAY[300], grid: EPIROC_GRAY[200], text: EPIROC_GRAY[600], tooltipBg: "#FFFFFF", tooltipBorder: EPIROC_GRAY[200] },
  dark: { axis: EPIROC_GRAY[600], grid: EPIROC_GRAY[800], text: EPIROC_GRAY[300], tooltipBg: EPIROC_GRAY[900], tooltipBorder: EPIROC_GRAY[700] },
};

export function getCategoricalPalette(mode: ThemeMode): string[] {
  return CATEGORICAL[mode];
}

export function getChartChrome(mode: ThemeMode) {
  return CHROME[mode];
}
