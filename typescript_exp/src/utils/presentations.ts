import { CsvRecord } from './csv';

export type Presentation = {
  year: string;
  title: string;
  titleNarrow?: string;
  venue: string;
  venueNarrow?: string;
  location: string;
  locationNarrow?: string;
};

export const SELECTED_PRESENTATIONS_PATH = '/selected_presentations.csv';
export const ALL_PRESENTATIONS_PATH = '/all_presentations.csv';

export const FALLBACK_PRESENTATIONS: Presentation[] = [
  {
    year: '2026',
    title: 'Coffee Machine keynote',
    titleNarrow: 'Coffee Machine keynote',
    venue: 'KUMU Museum',
    venueNarrow: 'KUMU Mus.',
    location: 'Tallinn (EE)',
    locationNarrow: 'Tallinn (EE)',
  },
  {
    year: '2025',
    title: 'AI Art Practices lecture',
    titleNarrow: 'AI Art lecture',
    venue: 'Deutsches Museum',
    venueNarrow: 'Deutsches Mus.',
    location: 'Nürnberg (DE)',
    locationNarrow: 'Nürnberg (DE)',
  },
  {
    year: '2025',
    title: 'Copy Machine talk',
    titleNarrow: 'Copy Machine',
    venue: 'Media Majlis NU-Q',
    venueNarrow: 'Media Majlis',
    location: 'Doha (QA)',
    locationNarrow: 'Doha (QA)',
  },
  {
    year: '2024',
    title: 'Life on _ performance',
    titleNarrow: 'Life on _',
    venue: 'SIGN',
    venueNarrow: 'SIGN',
    location: 'Groningen (NL)',
    locationNarrow: 'Groningen (NL)',
  },
  {
    year: '2024',
    title: 'Coffee Machine demo',
    titleNarrow: 'Coffee demo',
    venue: 'Chaos Comm. Congress',
    venueNarrow: 'Chaos Congress',
    location: 'Hamburg (DE)',
    locationNarrow: 'Hamburg (DE)',
  },
];

export const mapPresentation = (record: CsvRecord): Presentation | null => {
  const year = record.year?.trim();
  const title = record.title?.trim();
  const venue = record.venue?.trim();
  const location = record.location?.trim();

  if (!year || !title || !venue || !location) {
    return null;
  }

  const presentation: Presentation = {
    year,
    title,
    venue,
    location,
  };

  const titleNarrow = record['title_narrow']?.trim();
  const venueNarrow = record['venue_narrow']?.trim();
  const locationNarrow = record['location_narrow']?.trim();

  if (titleNarrow) {
    presentation.titleNarrow = titleNarrow;
  }
  if (venueNarrow) {
    presentation.venueNarrow = venueNarrow;
  }
  if (locationNarrow) {
    presentation.locationNarrow = locationNarrow;
  }

  return presentation;
};

const truncateCell = (value: string, maxLength: number) => {
  if (value.length <= maxLength) {
    return value.padEnd(maxLength, ' ');
  }

  if (maxLength <= 3) {
    return value.slice(0, maxLength);
  }

  return `${value.slice(0, maxLength - 3)}...`;
};

const clampColumnWidths = (
  sizes: { year: number; title: number; venue: number; location: number },
  maxWidth?: number
) => {
  if (!maxWidth) {
    return sizes;
  }

  const separatorWidth = 9; // three separators " | "
  const baseWidth = sizes.year + sizes.title + sizes.venue + sizes.location + separatorWidth;

  if (baseWidth <= maxWidth) {
    return sizes;
  }

  const availableForText = Math.max(3, maxWidth - separatorWidth);
  const minYear = Math.max(4, Math.min(sizes.year, 6));
  const flexibleBudget = Math.max(3, availableForText - minYear);
  const totalFlexible = sizes.title + sizes.venue + sizes.location || 1;
  const minColumnWidth = Math.max(2, Math.floor(flexibleBudget / 3));

  const scaledTitle = Math.max(
    minColumnWidth,
    Math.floor((sizes.title / totalFlexible) * flexibleBudget)
  );
  const scaledVenue = Math.max(
    minColumnWidth,
    Math.floor((sizes.venue / totalFlexible) * flexibleBudget)
  );
  const scaledLocation = Math.max(
    minColumnWidth,
    Math.floor((sizes.location / totalFlexible) * flexibleBudget)
  );

  const adjusted = {
    year: minYear,
    title: scaledTitle,
    venue: scaledVenue,
    location: scaledLocation
  };

  const targetTotal = Math.max(1, maxWidth - separatorWidth);
  let currentTotal = adjusted.year + adjusted.title + adjusted.venue + adjusted.location;

  while (currentTotal > targetTotal) {
    const largestKey = (['title', 'venue', 'location'] as const).reduce((maxKey, key) => {
      return adjusted[key] >= adjusted[maxKey] ? key : maxKey;
    }, 'title' as const);

    if (adjusted[largestKey] <= minColumnWidth) {
      break;
    }

    adjusted[largestKey] -= 1;
    currentTotal -= 1;
  }

  while (currentTotal < targetTotal) {
    const smallestKey = (['title', 'venue', 'location'] as const).reduce((minKey, key) => {
      return adjusted[key] <= adjusted[minKey] ? key : minKey;
    }, 'title' as const);

    adjusted[smallestKey] += 1;
    currentTotal += 1;
  }

  return adjusted;
};

export const formatPresentationsTable = (
  entries: Presentation[],
  isNarrow: boolean,
  maxWidth?: number
) => {
  if (!entries.length) {
    return 'No presentations found.';
  }

  const orderedSizes = entries.reduce(
    (acc, entry) => {
      const title = (isNarrow ? entry.titleNarrow : entry.title) || entry.title;
      const venue = (isNarrow ? entry.venueNarrow : entry.venue) || entry.venue;
      const location = (isNarrow ? entry.locationNarrow : entry.location) || entry.location;

      return {
        year: Math.max(acc.year, entry.year.length),
        title: Math.max(acc.title, title.length),
        venue: Math.max(acc.venue, venue.length),
        location: Math.max(acc.location, location.length),
      };
    },
    { year: 4, title: 10, venue: 10, location: 10 }
  );

  const sizes = clampColumnWidths(orderedSizes, maxWidth);

  const rows = entries.map(entry => {
    const title = (isNarrow ? entry.titleNarrow : entry.title) || entry.title;
    const venue = (isNarrow ? entry.venueNarrow : entry.venue) || entry.venue;
    const location = (isNarrow ? entry.locationNarrow : entry.location) || entry.location;

    const yearText = entry.year.slice(0, sizes.year).padEnd(sizes.year, ' ');
    const titleText = truncateCell(title, sizes.title);
    const venueText = truncateCell(venue, sizes.venue);
    const locationText = truncateCell(location, sizes.location);

    return `${yearText} | ${titleText} | ${venueText} | ${locationText}`;
  });

  // Clean ASCII-only rows separated by pipes, without unsupported box characters
  return rows.join('\n');
};
