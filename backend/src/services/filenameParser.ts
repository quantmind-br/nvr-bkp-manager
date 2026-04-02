export interface ParsedNvrFilename {
  channel: string | null;
  startTime: string | null;
  endTime: string | null;
  duration: number | null;
}

export const NVR_FILENAME_REGEX =
  /^(?<channel>[^_]+)_(?<startDate>\d{4}-\d{2}-\d{2})_(?<startTime>\d{2}-\d{2}-\d{2})_(?<endDate>\d{4}-\d{2}-\d{2})_(?<endTime>\d{2}-\d{2}-\d{2})\.(?<extension>[^.]+)$/;

function emptyParsedNvrFilename(): ParsedNvrFilename {
  return {
    channel: null,
    startTime: null,
    endTime: null,
    duration: null,
  };
}

function parseDateTime(
  datePart: string,
  timePart: string,
): { iso: string; timestamp: number } | null {
  const dateSegments = datePart.split("-");
  const timeSegments = timePart.split("-");

  const [yearText, monthText, dayText] = dateSegments;
  const [hourText, minuteText, secondText] = timeSegments;

  if (
    !yearText ||
    !monthText ||
    !dayText ||
    !hourText ||
    !minuteText ||
    !secondText
  ) {
    return null;
  }

  const year = Number.parseInt(yearText, 10);
  const month = Number.parseInt(monthText, 10);
  const day = Number.parseInt(dayText, 10);
  const hour = Number.parseInt(hourText, 10);
  const minute = Number.parseInt(minuteText, 10);
  const second = Number.parseInt(secondText, 10);

  if (
    [year, month, day, hour, minute, second].some((value) =>
      Number.isNaN(value),
    )
  ) {
    return null;
  }

  const timestamp = Date.UTC(year, month - 1, day, hour, minute, second);
  const parsedDate = new Date(timestamp);

  if (
    parsedDate.getUTCFullYear() !== year ||
    parsedDate.getUTCMonth() !== month - 1 ||
    parsedDate.getUTCDate() !== day ||
    parsedDate.getUTCHours() !== hour ||
    parsedDate.getUTCMinutes() !== minute ||
    parsedDate.getUTCSeconds() !== second
  ) {
    return null;
  }

  return {
    iso: `${datePart}T${timePart.replace(/-/g, ":")}`,
    timestamp,
  };
}

export function parseNvrFilename(filename: string): ParsedNvrFilename {
  try {
    const match = NVR_FILENAME_REGEX.exec(filename);
    const groups = match?.groups;

    if (!groups) {
      return emptyParsedNvrFilename();
    }

    const channel = groups["channel"];
    const startDate = groups["startDate"];
    const startTime = groups["startTime"];
    const endDate = groups["endDate"];
    const endTime = groups["endTime"];

    if (!channel || !startDate || !startTime || !endDate || !endTime) {
      return emptyParsedNvrFilename();
    }

    const start = parseDateTime(startDate, startTime);
    const end = parseDateTime(endDate, endTime);

    if (!start || !end || end.timestamp < start.timestamp) {
      return emptyParsedNvrFilename();
    }

    return {
      channel,
      startTime: start.iso,
      endTime: end.iso,
      duration: Math.floor((end.timestamp - start.timestamp) / 1000),
    };
  } catch {
    return emptyParsedNvrFilename();
  }
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "0s";
  }

  const wholeSeconds = Math.floor(seconds);
  const hours = Math.floor(wholeSeconds / 3600);
  const minutes = Math.floor((wholeSeconds % 3600) / 60);
  const remainingSeconds = wholeSeconds % 60;
  const parts: string[] = [];

  if (hours > 0) {
    parts.push(`${hours}h`);
  }

  if (minutes > 0) {
    parts.push(`${minutes}min`);
  }

  if (parts.length === 0 || (hours === 0 && remainingSeconds > 0)) {
    parts.push(`${remainingSeconds}s`);
  }

  return parts.join(" ");
}
