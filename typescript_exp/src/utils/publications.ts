import { CsvRecord } from './csv';

export type Publication = {
  year: string;
  title: string;
  titleNarrow?: string;
  venue: string;
  venueNarrow?: string;
};

export const SELECTED_PUBLICATIONS_PATH = '/selected_publications.csv';

export const FALLBACK_PUBLICATIONS: Publication[] = [
  {
    year: '2021',
    title: 'Towards Lightweight Controllable Audio Synthesis with Conditional Implicit Neural Representations',
    titleNarrow: 'Lightweight Audio Synthesis with PCINRs',
    venue: 'NeurIPS ML4CD Workshop',
    venueNarrow: 'NeurIPS ML4CD',
  },
];

export const mapPublication = (record: CsvRecord): Publication | null => {
  const year = record.year?.trim();
  const title = record.title?.trim();
  const venue = record.venue?.trim();

  if (!year || !title || !venue) {
    return null;
  }

  const publication: Publication = {
    year,
    title,
    venue,
  };

  const titleNarrow = record['title_narrow']?.trim();
  const venueNarrow = record['venue_narrow']?.trim();

  if (titleNarrow) {
    publication.titleNarrow = titleNarrow;
  }
  if (venueNarrow) {
    publication.venueNarrow = venueNarrow;
  }

  return publication;
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
  sizes: { year: number; title: number; venue: number },
  maxWidth?: number
) => {
  if (!maxWidth) {
    return sizes;
  }

  const separatorWidth = 6; // two separators " | "
  const baseWidth = sizes.year + sizes.title + sizes.venue + separatorWidth;

  if (baseWidth <= maxWidth) {
    return sizes;
  }

  const availableForText = Math.max(3, maxWidth - separatorWidth);
  const minYear = Math.max(4, Math.min(sizes.year, 6));
  const flexibleBudget = Math.max(3, availableForText - minYear);
  const totalFlexible = sizes.title + sizes.venue || 1;
  const minColumnWidth = Math.max(2, Math.floor(flexibleBudget / 2));

  const scaledTitle = Math.max(
    minColumnWidth,
    Math.floor((sizes.title / totalFlexible) * flexibleBudget)
  );
  const scaledVenue = Math.max(
    minColumnWidth,
    Math.floor((sizes.venue / totalFlexible) * flexibleBudget)
  );

  const adjusted = {
    year: minYear,
    title: scaledTitle,
    venue: scaledVenue
  };

  const targetTotal = Math.max(1, maxWidth - separatorWidth);
  let currentTotal = adjusted.year + adjusted.title + adjusted.venue;

  while (currentTotal > targetTotal) {
    const largestKey = (['title', 'venue'] as const).reduce((maxKey, key) => {
      return adjusted[key] >= adjusted[maxKey] ? key : maxKey;
    }, 'title' as const);

    if (adjusted[largestKey] <= minColumnWidth) {
      break;
    }

    adjusted[largestKey] -= 1;
    currentTotal -= 1;
  }

  while (currentTotal < targetTotal) {
    const smallestKey = (['title', 'venue'] as const).reduce((minKey, key) => {
      return adjusted[key] <= adjusted[minKey] ? key : minKey;
    }, 'title' as const);

    adjusted[smallestKey] += 1;
    currentTotal += 1;
  }

  return adjusted;
};

export const formatPublicationsTable = (
  entries: Publication[],
  isNarrow: boolean,
  maxWidth?: number
) => {
  if (!entries.length) {
    return 'No publications found.';
  }

  const orderedSizes = entries.reduce(
    (acc, entry) => {
      const title = (isNarrow ? entry.titleNarrow : entry.title) || entry.title;
      const venue = (isNarrow ? entry.venueNarrow : entry.venue) || entry.venue;

      return {
        year: Math.max(acc.year, entry.year.length),
        title: Math.max(acc.title, title.length),
        venue: Math.max(acc.venue, venue.length),
      };
    },
    { year: 4, title: 10, venue: 10 }
  );

  const sizes = clampColumnWidths(orderedSizes, maxWidth);

  const rows = entries.map(entry => {
    const title = (isNarrow ? entry.titleNarrow : entry.title) || entry.title;
    const venue = (isNarrow ? entry.venueNarrow : entry.venue) || entry.venue;

    const yearText = entry.year.slice(0, sizes.year).padEnd(sizes.year, ' ');
    const titleText = truncateCell(title, sizes.title);
    const venueText = truncateCell(venue, sizes.venue);

    return `${yearText} | ${titleText} | ${venueText}`;
  });

  const tableWidth = Math.max(...rows.map(r => r.length));
  const paddedRows = rows.map(r => r.padEnd(tableWidth, ' '));
  const topBorder = `┌${'─'.repeat(tableWidth)}┐`;
  const bottomBorder = `└${'─'.repeat(tableWidth)}┘`;

  return [topBorder, ...paddedRows.map(r => `|${r}|`), bottomBorder].join('\n');
};


