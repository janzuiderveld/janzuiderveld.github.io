import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const PRESENTATION_HEADERS = [
  'year',
  'work',
  'title',
  'title_narrow',
  'venue',
  'venue_narrow',
  'location',
  'location_narrow',
];

const parseCsvRows = (text) => {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];

    if (character === '"') {
      if (inQuotes && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (character === ',' && !inQuotes) {
      row.push(cell.trim());
      cell = '';
    } else if ((character === '\n' || character === '\r') && !inQuotes) {
      if (character === '\r' && text[index + 1] === '\n') {
        index += 1;
      }

      row.push(cell.trim());
      if (row.some(value => value !== '')) {
        rows.push(row);
      }
      row = [];
      cell = '';
    } else {
      cell += character;
    }
  }

  if (inQuotes) {
    throw new Error('Invalid CSV: unterminated quoted field');
  }

  row.push(cell.trim());
  if (row.some(value => value !== '')) {
    rows.push(row);
  }

  return rows;
};

export const parseCsvRecords = (text) => {
  const [rawHeaders, ...rows] = parseCsvRows(text);

  if (!rawHeaders) {
    return [];
  }

  const headers = rawHeaders.map((header, index) => (
    index === 0 ? header.replace(/^\uFEFF/, '') : header
  ));

  return rows.map(row => Object.fromEntries(
    headers.map((header, index) => [header, row[index] ?? ''])
  ));
};

const serializeCsvField = (value) => {
  const text = String(value ?? '');
  if (!/[",\r\n]/.test(text) && text.trim() === text) {
    return text;
  }
  return `"${text.replaceAll('"', '""')}"`;
};

const serializePresentation = (record) => PRESENTATION_HEADERS
  .map(header => serializeCsvField(record[header]))
  .join(',');

const extractStartYear = (dateRange) => {
  const europeanDate = dateRange.match(/(?:^|\D)\d{1,2}\/\d{1,2}\/(\d{4})(?:\D|$)/);
  if (europeanDate) {
    return europeanDate[1];
  }

  const isoDate = dateRange.match(/(?:^|\D)(\d{4})-\d{2}-\d{2}(?:\D|$)/);
  return isoDate?.[1] ?? '';
};

const splitVenueAndLocation = (value) => {
  const displayLocation = value.trim();
  const match = displayLocation.match(/^(.*?)\s*\(([^()]*)\)\s*$/);

  if (!match) {
    return { venue: displayLocation, location: displayLocation };
  }

  const venue = match[1].trim();
  const locationParts = match[2]
    .split(',')
    .map(part => part.trim())
    .filter(Boolean);
  const country = locationParts.pop();
  const place = locationParts.join(', ');

  if (!venue || !country) {
    return { venue: displayLocation, location: displayLocation };
  }

  return {
    venue,
    location: place ? `${place} (${country})` : country,
  };
};

const normalizeKeyPart = (value) => value
  .normalize('NFKC')
  .trim()
  .replace(/\s+/g, ' ')
  .toLocaleLowerCase('en');

const presentationKey = (record) => [
  record.year,
  record.work,
  record.title,
  record.venue,
  record.location,
].map(value => normalizeKeyPart(value ?? '')).join('\u001F');

const mapUpcomingRecord = (record, rowNumber) => {
  const sourceTitle = record.title?.trim() ?? '';
  const subtitle = record.subtitle?.trim() ?? '';
  const displayLocation = record.location?.trim() ?? '';
  const dateRange = record.date_range?.trim() || record.dates?.trim() || '';
  const eventTitle = subtitle || (sourceTitle === '-' ? '' : sourceTitle);
  const explicitYear = record.presentation_year?.trim() ?? '';
  const year = extractStartYear(dateRange) || (/^\d{4}$/.test(explicitYear) ? explicitYear : '');

  if (!sourceTitle || !eventTitle) {
    throw new Error(`Upcoming row ${rowNumber} needs a title or subtitle`);
  }
  if (!displayLocation) {
    throw new Error(`Upcoming entry "${eventTitle}" needs a location`);
  }
  if (!year) {
    throw new Error(
      `Upcoming entry "${eventTitle}" needs a date_range containing a calendar date or a four-digit presentation_year`
    );
  }

  const work = subtitle && sourceTitle !== '-' ? sourceTitle : '';
  const { venue, location } = splitVenueAndLocation(displayLocation);

  return {
    year,
    work,
    title: eventTitle,
    title_narrow: eventTitle,
    venue,
    venue_narrow: venue,
    location,
    location_narrow: location,
  };
};

const lineYear = (line) => {
  if (!line.trim()) {
    return null;
  }
  const row = parseCsvRows(line)[0];
  return /^\d{4}$/.test(row?.[0] ?? '') ? row[0] : null;
};

const insertByYear = (presentationsCsv, additions) => {
  if (!additions.length) {
    return presentationsCsv;
  }

  const newline = presentationsCsv.includes('\r\n') ? '\r\n' : '\n';
  const hasTrailingNewline = /\r?\n$/.test(presentationsCsv);
  const lines = presentationsCsv.split(/\r?\n/);
  if (hasTrailingNewline) {
    lines.pop();
  }

  const groups = new Map();
  additions.forEach(addition => {
    const group = groups.get(addition.year) ?? [];
    group.push(addition);
    groups.set(addition.year, group);
  });

  [...groups.entries()]
    .sort(([leftYear], [rightYear]) => Number(rightYear) - Number(leftYear))
    .forEach(([year, entries]) => {
      const serialized = entries.map(serializePresentation);
      const years = lines.map(lineYear);
      const matchingIndexes = years
        .map((lineValue, index) => lineValue === year ? index : -1)
        .filter(index => index >= 0);

      if (matchingIndexes.length) {
        lines.splice(matchingIndexes.at(-1) + 1, 0, ...serialized);
        return;
      }

      const firstDataIndex = years.findIndex(lineValue => lineValue !== null);
      const firstLowerIndex = years.findIndex(lineValue => (
        lineValue !== null && Number(lineValue) < Number(year)
      ));

      if (firstLowerIndex >= 0) {
        const separator = lines[firstLowerIndex - 1]?.trim() === '' ? [] : [''];
        lines.splice(firstLowerIndex, 0, ...separator, ...serialized, '');
      } else if (firstDataIndex >= 0 && Number(years[firstDataIndex]) > Number(year)) {
        if (lines.at(-1)?.trim() !== '') {
          lines.push('');
        }
        lines.push(...serialized);
      } else {
        lines.splice(firstDataIndex >= 0 ? firstDataIndex : lines.length, 0, ...serialized, '');
      }
    });

  while (lines.length > 1 && lines.at(-1) === '') {
    lines.pop();
  }

  return `${lines.join(newline)}${hasTrailingNewline ? newline : ''}`;
};

export const syncUpcomingIntoPresentations = (upcomingCsv, presentationsCsv) => {
  const upcomingRecords = parseCsvRecords(upcomingCsv);
  const presentationRecords = parseCsvRecords(presentationsCsv);
  const existingKeys = new Set(presentationRecords.map(presentationKey));
  const additions = [];

  upcomingRecords.forEach((record, index) => {
    const presentation = mapUpcomingRecord(record, index + 2);
    const key = presentationKey(presentation);

    if (!existingKeys.has(key)) {
      additions.push(presentation);
      existingKeys.add(key);
    }
  });

  return {
    csv: insertByYear(presentationsCsv, additions),
    addedCount: additions.length,
    addedEntries: additions,
  };
};

const isMainModule = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isMainModule) {
  const projectRoot = fileURLToPath(new URL('..', import.meta.url));
  const upcomingPath = `${projectRoot}/public/upcoming_exhibitions.csv`;
  const presentationsPath = `${projectRoot}/public/all_presentations.csv`;
  const [upcomingCsv, presentationsCsv] = await Promise.all([
    readFile(upcomingPath, 'utf8'),
    readFile(presentationsPath, 'utf8'),
  ]);
  const result = syncUpcomingIntoPresentations(upcomingCsv, presentationsCsv);

  if (result.csv !== presentationsCsv) {
    await writeFile(presentationsPath, result.csv, 'utf8');
  }

  const noun = result.addedCount === 1 ? 'entry' : 'entries';
  console.log(`Upcoming presentations sync: added ${result.addedCount} ${noun}.`);
}
