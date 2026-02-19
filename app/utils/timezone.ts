const DEFAULT_TIME_ZONE = 'Asia/Kolkata';

type TimeZoneParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

const partsFormatterCache = new Map<string, Intl.DateTimeFormat>();
const displayFormatterCache = new Map<string, Intl.DateTimeFormat>();

const getPartsFormatter = (timeZone: string) => {
  const cached = partsFormatterCache.get(timeZone);
  if (cached) return cached;

  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  partsFormatterCache.set(timeZone, formatter);
  return formatter;
};

const getDisplayFormatter = (timeZone: string, locale: string) => {
  const key = `${locale}|${timeZone}`;
  const cached = displayFormatterCache.get(key);
  if (cached) return cached;

  const formatter = new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone,
  });

  displayFormatterCache.set(key, formatter);
  return formatter;
};

const getPartValue = (parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes) => {
  const part = parts.find((item) => item.type === type)?.value ?? '';
  const parsed = Number.parseInt(part, 10);
  return Number.isFinite(parsed) ? parsed : 0;
};

const getTimeZoneParts = (date: Date, timeZone = DEFAULT_TIME_ZONE): TimeZoneParts => {
  const formatter = getPartsFormatter(timeZone);
  const parts = formatter.formatToParts(date);

  return {
    year: getPartValue(parts, 'year'),
    month: getPartValue(parts, 'month'),
    day: getPartValue(parts, 'day'),
    hour: getPartValue(parts, 'hour'),
    minute: getPartValue(parts, 'minute'),
    second: getPartValue(parts, 'second'),
  };
};

export const getTimeZoneDateKey = (date: Date, timeZone = DEFAULT_TIME_ZONE): string => {
  const parts = getTimeZoneParts(date, timeZone);
  const year = String(parts.year).padStart(4, '0');
  const month = String(parts.month).padStart(2, '0');
  const day = String(parts.day).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const getTimeZoneTimestampMs = (date: Date, timeZone = DEFAULT_TIME_ZONE): number => {
  const parts = getTimeZoneParts(date, timeZone);
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
};

export const getTimeZoneTimestampMsFromUtcString = (
  utcString: string,
  timeZone = DEFAULT_TIME_ZONE
): number => getTimeZoneTimestampMs(new Date(utcString), timeZone);

export const normalizeUtcDateKeyToTimeZone = (
  utcDateKey: string,
  timeZone = DEFAULT_TIME_ZONE
): string => getTimeZoneDateKey(new Date(`${utcDateKey}T00:00:00Z`), timeZone);

export const formatDateTimeInTimeZone = (
  utcString: string,
  timeZone = DEFAULT_TIME_ZONE,
  locale = 'en-IN'
): string => {
  const date = new Date(utcString);
  const formatter = getDisplayFormatter(timeZone, locale);
  return formatter.format(date);
};

export const getDefaultTimeZone = () => DEFAULT_TIME_ZONE;
