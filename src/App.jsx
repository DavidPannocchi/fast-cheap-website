import { useEffect } from 'react';
import contentHtml from './content.html?raw';
import BriefPage from './BriefPage.jsx';
import './styles.css';

export default function App() {
  const isBriefPage = window.location.pathname === '/brief';

  useEffect(() => {
    if (isBriefPage) return;

    let active = true;
    let cleanup;

    import('./legacyBehavior.js').then((mod) => {
      if (!active) return;
      mod.initLegacyBehavior();
      cleanup = mod.cleanupLegacyBehavior;
    });

    return () => {
      active = false;
      cleanup?.();
    };
  }, [isBriefPage]);

  if (isBriefPage) {
    return <BriefPage />;
  }

  return <div dangerouslySetInnerHTML={{ __html: contentHtml }} />;
}

