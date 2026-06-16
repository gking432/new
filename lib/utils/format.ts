import { format, formatDistanceToNow, isToday, isPast, parseISO } from "date-fns";

export function formatMoney(value: number | null | undefined) {
  if (value == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatMoneyRange(
  min: number | null | undefined,
  max: number | null | undefined
) {
  if (min == null && max == null) return "—";
  if (min != null && max != null) return `${formatMoney(min)}–${formatMoney(max)}`;
  return formatMoney(min ?? max);
}

export function estimatedValueMidpoint(
  min: number | null | undefined,
  max: number | null | undefined
) {
  if (min == null && max == null) return 0;
  if (min != null && max != null) return (min + max) / 2;
  return min ?? max ?? 0;
}

export function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return format(parseISO(value), "MMM d, yyyy");
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  return format(parseISO(value), "MMM d, yyyy h:mm a");
}

export function formatRelative(value: string | null | undefined) {
  if (!value) return "—";
  return formatDistanceToNow(parseISO(value), { addSuffix: true });
}

export function isDueToday(value: string | null | undefined) {
  if (!value) return false;
  return isToday(parseISO(value));
}

export function isOverdue(value: string | null | undefined) {
  if (!value) return false;
  const date = parseISO(value);
  return isPast(date) && !isToday(date);
}

export function isPastDue(value: string | null | undefined) {
  if (!value) return false;
  const due = parseISO(value);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDay = new Date(due);
  dueDay.setHours(0, 0, 0, 0);
  return dueDay.getTime() < today.getTime();
}

export function formatTaskDueDate(value: string | null | undefined) {
  if (!value) return "No due date";
  const due = parseISO(value);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDay = new Date(due);
  dueDay.setHours(0, 0, 0, 0);
  const diffDays = Math.round((dueDay.getTime() - today.getTime()) / 86_400_000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays === -1) return "Yesterday";
  return format(due, "MMM d, yyyy");
}

export function initials(name: string | null | undefined) {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
}

export function fullName(first: string, last: string) {
  return `${first} ${last}`.trim();
}

export function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}
