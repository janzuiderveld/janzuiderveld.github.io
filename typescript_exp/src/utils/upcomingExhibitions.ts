import { loadCsv } from './csv';
import type { CsvRecord } from './csv';

export type Exhibition = {
  title: string;
  subtitle?: string;
  location?: string;
  dateRange?: string;
};

export const UPCOMING_EXHIBITIONS_PATH = '/upcoming_exhibitions.csv';

export const FALLBACK_EXHIBITIONS: Exhibition[] = [
  {
    title: 'Coffee Machine',
    location: 'Deutsches Museum Nürnberg (Nürnberg, DE)',
    dateRange: '29/04/2025 > 29/06/2025',
  },
  {
    title: 'Coffee Machine',
    subtitle: 'AI Ecologies',
    location: 'Artphy (Onstwedde, NL)',
    dateRange: '06/07/2025 > 30/08/2025',
  },
  {
    title: 'Keynote lecture',
    subtitle: 'AI in Art Practices and Research Conference',
    location: 'I.L. Caragiale - National University of Theatre and Film (Bucharest, RO)',
    dateRange: '24/10/2025',
  },
  {
    title: 'Workshop',
    subtitle: 'AI in Art Practices and Research Conference',
    location: 'I.L. Caragiale - National University of Theatre and Film (Bucharest, RO)',
    dateRange: '25/10/2025',
  },
  {
    title: 'Life on _',
    subtitle: 'Big Dada',
    location: 'Arti et Amicae (Amsterdam, NL)',
    dateRange: '30/10/2025 > 21/11/2025',
  },
  {
    title: 'Coffee Machine',
    location: 'KUMU Kunstimuuseum (Tallinn, EE)',
    dateRange: '12/02/2026 > 23/08/2026',
  },
  {
    title: '-',
    subtitle: 'Semi-permanent installation',
    location: 'California Institute for Machine Consciousness (San Francisco, US)',
    dateRange: '1/6/2026 > ?',
  },
  {
    title: '-',
    subtitle: 'Hello Worlds!',
    location: 'Ars Electronica Center (Linz, AT)',
    dateRange: '9/9/2026 > ?',
  },
];

export const mapExhibition = (record: CsvRecord): Exhibition | null => {
  const title = record.title?.trim();
  const subtitle = record.subtitle?.trim();
  const location = record.location?.trim();
  const dateRange = record['date_range']?.trim() || record.dates?.trim();

  if (!title) {
    return null;
  }

  const exhibition: Exhibition = { title };

  if (subtitle) {
    exhibition.subtitle = subtitle;
  }
  if (location) {
    exhibition.location = location;
  }
  if (dateRange) {
    exhibition.dateRange = dateRange;
  }

  return exhibition;
};

export const parseUpcomingExhibitions = (records: CsvRecord[]): Exhibition[] => {
  return records
    .map(mapExhibition)
    .filter((item): item is Exhibition => Boolean(item));
};

export const loadUpcomingExhibitions = async (): Promise<Exhibition[]> => {
  const records = await loadCsv(UPCOMING_EXHIBITIONS_PATH);
  return parseUpcomingExhibitions(records);
};

export const areExhibitionsEqual = (left: Exhibition[], right: Exhibition[]): boolean => {
  return left.length === right.length && left.every((entry, index) => (
    entry.title === right[index].title &&
    entry.subtitle === right[index].subtitle &&
    entry.location === right[index].location &&
    entry.dateRange === right[index].dateRange
  ));
};

export const formatUpcomingText = (entries: Exhibition[]): string => {
  const heading = '==Upcoming ⟋ ongoing==';

  if (!entries.length) {
    return `${heading}\n\n-- none scheduled --`;
  }

  const blocks = entries.map(entry => {
    const lines: string[] = [];
    if (entry.subtitle) {
      lines.push(`==${entry.subtitle}==`);
    }
    if (entry.location) {
      lines.push(`//${entry.location}//`);
    }
    if (entry.dateRange) {
      lines.push(entry.dateRange);
    }
    return lines.join('\n');
  });

  return [heading, ...blocks].join('\n\n');
};
