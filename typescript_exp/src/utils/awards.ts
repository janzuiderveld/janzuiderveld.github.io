import { CsvRecord } from './csv';

export type Award = {
  year: string;
  title: string;
  titleNarrow?: string;
  organization: string;
  organizationNarrow?: string;
};

export const SELECTED_AWARDS_PATH = '/selected_awards.csv';

export const FALLBACK_AWARDS: Award[] = [
  {
    year: '2024',
    title: 'Honorary Mention - Interactive Art+',
    titleNarrow: 'Hon. Mention - Interactive Art+',
    organization: 'Prix Ars Electronica',
    organizationNarrow: 'Prix Ars Electronica',
  },
  {
    year: '2024',
    title: 'Honorary Mention - u19',
    titleNarrow: 'Hon. Mention - u19',
    organization: 'Prix Ars Electronica',
    organizationNarrow: 'Prix Ars Electronica',
  },
];

export const mapAward = (record: CsvRecord): Award | null => {
  const year = record.year?.trim();
  const title = record.title?.trim();
  const organization = record.organization?.trim();

  if (!year || !title || !organization) {
    return null;
  }

  const award: Award = {
    year,
    title,
    organization,
  };

  const titleNarrow = record['title_narrow']?.trim();
  const organizationNarrow = record['organization_narrow']?.trim();

  if (titleNarrow) {
    award.titleNarrow = titleNarrow;
  }
  if (organizationNarrow) {
    award.organizationNarrow = organizationNarrow;
  }

  return award;
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
  sizes: { year: number; title: number; organization: number },
  maxWidth?: number
) => {
  if (!maxWidth) {
    return sizes;
  }

  const separatorWidth = 6; // two separators " | "
  const baseWidth = sizes.year + sizes.title + sizes.organization + separatorWidth;

  if (baseWidth <= maxWidth) {
    return sizes;
  }

  const availableForText = Math.max(3, maxWidth - separatorWidth);
  const minYear = Math.max(4, Math.min(sizes.year, 6));
  const flexibleBudget = Math.max(3, availableForText - minYear);
  const totalFlexible = sizes.title + sizes.organization || 1;
  const minColumnWidth = Math.max(2, Math.floor(flexibleBudget / 2));

  const scaledTitle = Math.max(
    minColumnWidth,
    Math.floor((sizes.title / totalFlexible) * flexibleBudget)
  );
  const scaledOrg = Math.max(
    minColumnWidth,
    Math.floor((sizes.organization / totalFlexible) * flexibleBudget)
  );

  const adjusted = {
    year: minYear,
    title: scaledTitle,
    organization: scaledOrg
  };

  const targetTotal = Math.max(1, maxWidth - separatorWidth);
  let currentTotal = adjusted.year + adjusted.title + adjusted.organization;

  while (currentTotal > targetTotal) {
    const largestKey = (['title', 'organization'] as const).reduce((maxKey, key) => {
      return adjusted[key] >= adjusted[maxKey] ? key : maxKey;
    }, 'title' as const);

    if (adjusted[largestKey] <= minColumnWidth) {
      break;
    }

    adjusted[largestKey] -= 1;
    currentTotal -= 1;
  }

  while (currentTotal < targetTotal) {
    const smallestKey = (['title', 'organization'] as const).reduce((minKey, key) => {
      return adjusted[key] <= adjusted[minKey] ? key : minKey;
    }, 'title' as const);

    adjusted[smallestKey] += 1;
    currentTotal += 1;
  }

  return adjusted;
};

export const formatAwardsTable = (
  entries: Award[],
  isNarrow: boolean,
  maxWidth?: number
) => {
  if (!entries.length) {
    return 'No awards found.';
  }

  const orderedSizes = entries.reduce(
    (acc, entry) => {
      const title = (isNarrow ? entry.titleNarrow : entry.title) || entry.title;
      const org = (isNarrow ? entry.organizationNarrow : entry.organization) || entry.organization;

      return {
        year: Math.max(acc.year, entry.year.length),
        title: Math.max(acc.title, title.length),
        organization: Math.max(acc.organization, org.length),
      };
    },
    { year: 4, title: 10, organization: 10 }
  );

  const sizes = clampColumnWidths(orderedSizes, maxWidth);

  const rows = entries.map(entry => {
    const title = (isNarrow ? entry.titleNarrow : entry.title) || entry.title;
    const org = (isNarrow ? entry.organizationNarrow : entry.organization) || entry.organization;

    const yearText = entry.year.slice(0, sizes.year).padEnd(sizes.year, ' ');
    const titleText = truncateCell(title, sizes.title);
    const orgText = truncateCell(org, sizes.organization);

    return `${yearText} | ${titleText} | ${orgText}`;
  });

  // Clean ASCII-only rows separated by pipes, without unsupported box characters
  return rows.join('\n');
};
