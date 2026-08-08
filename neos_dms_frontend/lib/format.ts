const nprFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "NPR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Nepal uses Indian digit grouping (lakh/crore), not thousands. */
export function formatMoney(value: string | number): string {
  const numeric = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(numeric)) return "—";
  return nprFormatter.format(numeric);
}

const groupedFormatter = new Intl.NumberFormat("en-IN");

export function formatNumber(value: string | number): string {
  const numeric = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(numeric)) return "—";
  return groupedFormatter.format(numeric);
}

/** ISO AD date (YYYY-MM-DD) → readable AD. */
export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function formatTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
