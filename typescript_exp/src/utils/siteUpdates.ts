type UpdateLocation = Pick<Location, 'href' | 'replace'>;

// GitHub Pages gives HTML a cache lifetime that we cannot override in a file.
// A tiny uncached manifest lets a cached entry page recover without clearing
// the visitor's storage or making fingerprinted artwork assets uncacheable.
export const checkForSiteUpdate = async (buildId: string, location: UpdateLocation = window.location): Promise<boolean> => {
  try {
    const response = await fetch(`/site-version.json?check=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) return false;
    const { id } = await response.json();
    if (typeof id !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(id) || id === buildId) return false;
    const key = 'site-refreshed-build';
    // If storage is unavailable, the catch below prevents an unguarded loop.
    if (sessionStorage.getItem(key) === id) return false;
    sessionStorage.setItem(key, id);
    const url = new URL(location.href);
    url.searchParams.set('v', id);
    location.replace(url.href);
    return true;
  } catch {
    // Offline, blocked storage, missing manifest: keep the current site usable.
    return false;
  }
};

export const loadCurrentPage = async <T>(load: () => Promise<T>, buildId: string, location?: UpdateLocation): Promise<T> => {
  try {
    return await load();
  } catch (error) {
    // Pages deployments remove old hashed chunks. Recover a tab that stayed
    // open across deployment before React tries to render a rejected route.
    if (await checkForSiteUpdate(buildId, location)) return new Promise<T>(() => {});
    throw error;
  }
};

export const installSiteUpdateCheck = (buildId: string) => {
  let lastCheck = -Infinity;
  const check = () => {
    if (document.hidden || Date.now() - lastCheck < 60000) return;
    lastCheck = Date.now();
    void checkForSiteUpdate(buildId);
  };
  check();
  window.addEventListener('pageshow', check);
  document.addEventListener('visibilitychange', check);
  return () => {
    window.removeEventListener('pageshow', check);
    document.removeEventListener('visibilitychange', check);
  };
};
