import { useEffect, useState } from 'react';

/**
 * Hash routing. Six screens do not need a routing library, and this keeps the
 * app a single static bundle that opens from any path.
 */
export interface Route {
  name: string;
  id: string | null;
}

export function parseHash(): Route {
  const parts = window.location.hash.replace(/^#/, '').split('/').filter(Boolean);
  return { name: parts[0] ?? 'dashboard', id: parts[1] ?? null };
}

export function navigate(path: string): void {
  window.location.hash = `#${path}`;
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(parseHash);

  useEffect(() => {
    const onChange = () => {
      setRoute(parseHash());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  return route;
}
