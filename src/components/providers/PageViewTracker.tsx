import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { usePostHog } from '@posthog/react';

export function PageViewTracker() {
  const location = useLocation();
  const posthog = usePostHog();

  useEffect(() => {
    if (posthog) {
      // Captura manual de pageview.
      // O HashRouter é rastreado corretamente usando location.pathname + location.hash
      posthog.capture('$pageview', {
        $current_url: window.location.href,
        path: location.pathname + location.search + location.hash,
        title: document.title || 'Painel Admin',
      });
    }
  }, [location, posthog]);

  return null;
}
