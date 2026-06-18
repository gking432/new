export const DEMO_TIME_ZONE = "America/Chicago";

type WallClockParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function partsInDemoTime(date: Date): WallClockParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: DEMO_TIME_ZONE,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    year: Number(byType.year),
    month: Number(byType.month),
    day: Number(byType.day),
    hour: Number(byType.hour),
    minute: Number(byType.minute),
    second: Number(byType.second),
  };
}

export function demoWallClockParts(date = new Date()) {
  return partsInDemoTime(date);
}

export function dateFromDemoWallClock(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0
) {
  let utc = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  for (let i = 0; i < 3; i += 1) {
    const parts = partsInDemoTime(utc);
    const displayedAsUtc = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second
    );
    const desiredAsUtc = Date.UTC(year, month - 1, day, hour, minute, second);
    const delta = displayedAsUtc - desiredAsUtc;
    if (delta === 0) break;
    utc = new Date(utc.getTime() - delta);
  }
  return utc;
}

export function demoDatePlusDays(daysAhead: number, hour = 0, minute = 0) {
  const today = partsInDemoTime(new Date());
  return dateFromDemoWallClock(today.year, today.month, today.day + daysAhead, hour, minute, 0);
}

export function demoDayOfWeek(date: Date) {
  const parts = partsInDemoTime(date);
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay();
}

export function demoDateKey(date: Date) {
  const parts = partsInDemoTime(date);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

export function dateFromDemoDateKey(key: string, hour = 0, minute = 0) {
  const [year, month, day] = key.split("-").map(Number);
  return dateFromDemoWallClock(year, month, day, hour, minute, 0);
}

export function sameDemoDay(a: Date, b: Date) {
  return demoDateKey(a) === demoDateKey(b);
}

export function formatDemoDate(date: Date, options: Intl.DateTimeFormatOptions = {}) {
  return date.toLocaleDateString("en-US", {
    timeZone: DEMO_TIME_ZONE,
    ...options,
  });
}

export function formatDemoTime(date: Date, options: Intl.DateTimeFormatOptions = {}) {
  return date.toLocaleTimeString("en-US", {
    timeZone: DEMO_TIME_ZONE,
    hour: "numeric",
    minute: "2-digit",
    ...options,
  });
}

export function formatDemoDateTime(date: Date, options: Intl.DateTimeFormatOptions = {}) {
  return date.toLocaleString("en-US", {
    timeZone: DEMO_TIME_ZONE,
    ...options,
  });
}

export function demoShortDate(date: Date) {
  return formatDemoDate(date, { month: "2-digit", day: "2-digit" });
}

export function demoNextDateOptions(days = 7) {
  return Array.from({ length: days }, (_, index) => {
    const date = demoDatePlusDays(index, 12, 0);
    return {
      key: demoDateKey(date),
      date,
      dayOfWeek: demoDayOfWeek(date),
      label: demoShortDate(date),
    };
  });
}
