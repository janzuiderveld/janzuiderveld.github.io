import { afterEach, expect, it, vi } from 'vitest';
import { loadCsv } from './csv';

afterEach(() => vi.unstubAllGlobals());
it('revalidates mutable CSV files instead of reusing a fresh cached event list', async () => {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: async () => 'name\nCurrent event' });
  vi.stubGlobal('fetch', fetchMock);
  expect(await loadCsv('/upcoming_exhibitions.csv')).toEqual([{ name: 'Current event' }]);
  expect(fetchMock).toHaveBeenCalledWith('/upcoming_exhibitions.csv', { cache: 'no-cache' });
});
