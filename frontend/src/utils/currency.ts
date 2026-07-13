export function formatCurrency(value: number): string {
  return value.toLocaleString("en-ZA", { style: "currency", currency: "ZAR", maximumFractionDigits: 0 });
}
