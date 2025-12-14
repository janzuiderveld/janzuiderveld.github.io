export type CsvRecord = Record<string, string>;

const parseLine = (line: string): string[] => {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      cells.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  cells.push(current.trim());
  return cells;
};

export const parseCsv = (text: string): CsvRecord[] => {
  const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');

  if (!lines.length) {
    return [];
  }

  const headers = parseLine(lines[0]).map(header => header.trim());

  return lines.slice(1)
    .map(parseLine)
    .filter(cells => cells.some(cell => cell.trim() !== ''))
    .map(cells => {
      const record: CsvRecord = {};
      headers.forEach((header, index) => {
        record[header] = cells[index] ?? '';
      });
      return record;
    });
};

export const loadCsv = async (url: string): Promise<CsvRecord[]> => {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to load CSV from ${url}: ${response.status}`);
  }

  const text = await response.text();
  return parseCsv(text);
};
