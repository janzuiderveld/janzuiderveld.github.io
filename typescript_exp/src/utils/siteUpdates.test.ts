import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { checkForSiteUpdate, loadCurrentPage } from './siteUpdates';

const replace = vi.fn();
const location = { href: 'https://warana.xyz/?keep=1#/coffee?photo=1', replace };
beforeEach(() => { sessionStorage.clear(); replace.mockClear(); });
afterEach(() => vi.unstubAllGlobals());
const manifest = (id: unknown) => vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
  ok: true, json: async () => ({ id })
}));

describe('site build refresh', () => {
  it('loads a route without making a freshness request when its chunk is available', async () => {
    const module = { default: 'page' };
    manifest('current');
    expect(await loadCurrentPage(() => Promise.resolve(module), 'current', location)).toBe(module);
    expect(fetch).not.toHaveBeenCalled();
  });
  it('recovers a removed route chunk after deployment without resolving an invalid React page', async () => {
    manifest('next');
    let settled = false;
    void loadCurrentPage(() => Promise.reject(new Error('chunk 404')), 'old', location).then(() => { settled = true; });
    await vi.waitFor(() => expect(replace).toHaveBeenCalledTimes(1));
    expect(settled).toBe(false);
  });
  it('propagates a route failure when no new build exists, without a reload loop', async () => {
    manifest('current');
    const failure = new Error('offline chunk');
    await expect(loadCurrentPage(() => Promise.reject(failure), 'current', location)).rejects.toBe(failure);
    expect(replace).not.toHaveBeenCalled();
  });
  it('revalidates a build manifest and preserves the route when refreshing stale HTML', async () => {
    manifest('new-build');
    await checkForSiteUpdate('old-build', location);
    const url = new URL(replace.mock.calls[0][0]);
    expect(url.hash).toBe('#/coffee?photo=1');
    expect(url.searchParams.get('keep')).toBe('1');
    expect(url.searchParams.get('v')).toBe('new-build');
    expect(fetch).toHaveBeenCalledWith(expect.stringMatching(/^\/site-version.json\?/), { cache: 'no-store' });
  });
  it('does nothing for the current build', async () => {
    manifest('current');
    await checkForSiteUpdate('current', location);
    expect(replace).not.toHaveBeenCalled();
  });
  it('reloads only once per target version even if an edge serves stale HTML again', async () => {
    manifest('new-build');
    await checkForSiteUpdate('old-build', location);
    await checkForSiteUpdate('old-build', location);
    expect(replace).toHaveBeenCalledTimes(1);
  });
  it.each([null, undefined, 4, '', '../other'])('ignores an invalid manifest id (%s)', async id => {
    manifest(id);
    await checkForSiteUpdate('current', location);
    expect(replace).not.toHaveBeenCalled();
  });
  it('leaves the site usable while offline or during an incomplete deployment', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    await checkForSiteUpdate('current', location);
    expect(replace).not.toHaveBeenCalled();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    await checkForSiteUpdate('current', location);
    expect(replace).not.toHaveBeenCalled();
  });
});
