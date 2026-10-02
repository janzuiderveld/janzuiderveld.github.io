import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FALLBACK_EXHIBITIONS } from '../src/utils/upcomingExhibitions';
import { FALLBACK_PRESENTATIONS } from '../src/utils/presentations';
import {
  parseCsvRecords,
  syncUpcomingIntoPresentations,
} from './sync-upcoming-presentations.mjs';

const projectRoot = process.cwd();

const presentationsHeader = [
  'year',
  'work',
  'title',
  'title_narrow',
  'venue',
  'venue_narrow',
  'location',
  'location_narrow',
].join(',');

describe('syncUpcomingIntoPresentations', () => {
  it('maps upcoming entries into presentation rows and keeps them ordered by year', () => {
    const upcomingCsv = [
      'title,subtitle,location,date_range',
      'Coffee Machine,"Dutch, More or Less","Het Nieuwe Instituut (Rotterdam, NL)",01/06/2024 > 30/05/2026',
      '-,re:publica,"STATION Berlin (Berlin, DE)",18/05/2026 > 20/05/2026',
      '-,Founding Assembly,"Lighthaven (Berkeley, CA, US)",29/05/2026 > 31/05/2026',
    ].join('\n');
    const presentationsCsv = [
      presentationsHeader,
      '2025,,Existing event,Existing event,Existing venue,Existing venue,Amsterdam (NL),Amsterdam (NL)',
      '',
      '2024,Coffee Machine,"Dutch, More or Less",Dutch More or Less,Het Nieuwe Instituut,Het Nieuwe Instituut,Rotterdam (NL),Rotterdam (NL)',
      '',
    ].join('\n');

    const result = syncUpcomingIntoPresentations(upcomingCsv, presentationsCsv);
    const records = parseCsvRecords(result.csv);

    expect(result.addedCount).toBe(2);
    expect(records.map(record => record.year)).toEqual(['2026', '2026', '2025', '2024']);
    expect(records[0]).toMatchObject({
      year: '2026',
      work: '',
      title: 're:publica',
      venue: 'STATION Berlin',
      location: 'Berlin (DE)',
    });
    expect(records[1]).toMatchObject({
      year: '2026',
      work: '',
      title: 'Founding Assembly',
      venue: 'Lighthaven',
      location: 'Berkeley, CA (US)',
    });
    expect(result.csv).toContain(
      '2024,Coffee Machine,"Dutch, More or Less",Dutch More or Less,Het Nieuwe Instituut'
    );
  });

  it('is idempotent when the generated rows already exist', () => {
    const upcomingCsv = [
      'title,subtitle,location,date_range',
      '-,re:publica,"STATION Berlin (Berlin, DE)",18/05/2026 > 20/05/2026',
    ].join('\n');
    const presentationsCsv = [presentationsHeader, ''].join('\n');

    const first = syncUpcomingIntoPresentations(upcomingCsv, presentationsCsv);
    const second = syncUpcomingIntoPresentations(upcomingCsv, first.csv);

    expect(first.addedCount).toBe(1);
    expect(second.addedCount).toBe(0);
    expect(second.csv).toBe(first.csv);
  });

  it('fails loudly when an upcoming entry cannot provide a presentation year', () => {
    const upcomingCsv = [
      'title,subtitle,location,date_range',
      'Coffee Machine,Undated event,"Some Venue (Amsterdam, NL)",soon',
    ].join('\n');

    expect(() => syncUpcomingIntoPresentations(upcomingCsv, `${presentationsHeader}\n`))
      .toThrow(/Undated event.*date_range/i);
  });

  it('uses an explicit presentation year for permanent ongoing entries', () => {
    const upcomingCsv = [
      'title,subtitle,location,date_range,presentation_year',
      '-,"On permanent view — also available for bookings in the San Francisco area","California Institute for Machine Consciousness (San Francisco, US)",ongoing,2026',
    ].join('\n');

    const result = syncUpcomingIntoPresentations(upcomingCsv, `${presentationsHeader}\n`);
    const [record] = parseCsvRecords(result.csv);

    expect(result.addedCount).toBe(1);
    expect(record).toMatchObject({
      year: '2026',
      title: 'On permanent view — also available for bookings in the San Francisco area',
      venue: 'California Institute for Machine Consciousness',
      location: 'San Francisco (US)',
    });
  });

  it('is invoked by deploy.sh before the production build', () => {
    const deployScript = readFileSync(`${projectRoot}/deploy.sh`, 'utf8');
    const syncIndex = deployScript.indexOf('npm run sync:presentations');
    const buildIndex = deployScript.indexOf('npm run build');

    expect(syncIndex).toBeGreaterThan(-1);
    expect(syncIndex).toBeLessThan(buildIndex);
  });

  it('keeps the checked-in presentation log synchronized with upcoming entries', () => {
    const upcomingCsv = readFileSync(`${projectRoot}/public/upcoming_exhibitions.csv`, 'utf8');
    const presentationsCsv = readFileSync(`${projectRoot}/public/all_presentations.csv`, 'utf8');

    const result = syncUpcomingIntoPresentations(upcomingCsv, presentationsCsv);

    expect(result.addedCount).toBe(0);
    expect(result.csv).toBe(presentationsCsv);
  });

  it('lists the BOUNDED SPACE residency with the requested dates and keeps it in the full log', () => {
    const upcomingRecords = parseCsvRecords(
      readFileSync(`${projectRoot}/public/upcoming_exhibitions.csv`, 'utf8')
    );
    const presentationRecords = parseCsvRecords(
      readFileSync(`${projectRoot}/public/all_presentations.csv`, 'utf8')
    );
    const title = '798 Multidisciplinary Residency';
    const matches = upcomingRecords.filter(record => record.subtitle === title);
    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({
      title: '-',
      location: 'BOUNDED SPACE, 798 Art District (Beijing, CN)',
      date_range: '08/11/2026 > 19/12/2026',
    });
    expect(FALLBACK_EXHIBITIONS).toContainEqual(expect.objectContaining({
      title: '-',
      subtitle: title,
      location: matches[0].location,
      dateRange: matches[0].date_range,
    }));
    const loggedMatches = presentationRecords.filter(record => record.title === title);
    expect(loggedMatches).toHaveLength(1);
    expect(loggedMatches[0]).toMatchObject({
      year: '2026',
      venue: 'BOUNDED SPACE, 798 Art District',
      location: 'Beijing (CN)',
    });
  });

  it('keeps the requested upcoming and all-event content corrections checked in', () => {
    const upcomingRecords = parseCsvRecords(
      readFileSync(`${projectRoot}/public/upcoming_exhibitions.csv`, 'utf8')
    );
    const presentationRecords = parseCsvRecords(
      readFileSync(`${projectRoot}/public/all_presentations.csv`, 'utf8')
    );
    const upcomingText = upcomingRecords
      .flatMap(record => [record.title, record.subtitle, record.location])
      .join('\n');

    expect(upcomingText).not.toContain('re:publica');
    expect(upcomingText).not.toContain('Dutch, More or Less');
    expect(upcomingText).not.toContain('The Founding Assembly for Machine Consciousness Research');
    expect(upcomingRecords).toContainEqual(expect.objectContaining({
      subtitle: 'Semi-permanent installation',
      location: 'California Institute for Machine Consciousness (San Francisco, US)',
      date_range: '1/6/2026 > ?',
    }));
    expect(upcomingRecords).toContainEqual(expect.objectContaining({
      subtitle: 'Hello Worlds!',
      location: 'Ars Electronica Center (Linz, AT)',
      date_range: '9/9/2026 > ?',
    }));
    const selectedRecords = parseCsvRecords(
      readFileSync(`${projectRoot}/public/selected_presentations.csv`, 'utf8')
    );
    for (const [title, location] of [
      ['Conflux Festival 2026', 'Rotterdam (NL)'],
      ['Triumph of Galatea. Art in the Age of AI', 'Tallinn (EE)'],
    ]) {
      expect(upcomingRecords.some(record => record.subtitle === title)).toBe(false);
      for (const records of [selectedRecords, presentationRecords]) {
        const matches = records.filter(record => record.title === title);
        expect(matches).toHaveLength(1);
        expect(matches[0]).toMatchObject({ year: '2026', location });
      }
      expect(FALLBACK_PRESENTATIONS).toContainEqual(expect.objectContaining({
        year: '2026', title, location,
      }));
    }
    expect(FALLBACK_EXHIBITIONS.some(entry =>
      entry.subtitle === 'Conflux Festival 2026' || entry.location?.includes('KUMU')
    )).toBe(false);
    expect(upcomingRecords).toContainEqual(expect.objectContaining({
      title: 'Coffee Machine',
      subtitle: 'KIKK Festival 2026',
      location: 'Le Delta (Namur, BE)',
      date_range: '22/10/2026 > 25/10/2026',
    }));
    expect(FALLBACK_EXHIBITIONS).toContainEqual(expect.objectContaining({
      title: 'Coffee Machine',
      subtitle: 'KIKK Festival 2026',
      location: 'Le Delta (Namur, BE)',
      dateRange: '22/10/2026 > 25/10/2026',
    }));
    expect(presentationRecords).toContainEqual(expect.objectContaining({
      year: '2026',
      title: 'Delft Maker Faire 2026',
      venue: 'Delft Maker Faire',
      location: 'Delft (NL)',
    }));
    expect(presentationRecords).toContainEqual(expect.objectContaining({
      year: '2026',
      title: 'Hello Worlds!',
      venue: 'Ars Electronica Center',
      location: 'Linz (AT)',
    }));
  });
});
