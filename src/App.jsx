import { useEffect } from 'react';
import contentHtml from './content.html?raw';
import BriefPage from './BriefPage.jsx';
import DominioPage from './DominioPage.jsx';
import './styles.css';

export default function App() {
  const pathname = window.location.pathname;
  const isBriefPage = pathname === '/brief';
  const isDominioPage = pathname === '/dominio';

  useEffect(() => {
    if (isBriefPage || isDominioPage) return;

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
  }, [isBriefPage, isDominioPage]);

  if (isBriefPage) {
    return <BriefPage />;
  }

  if (isDominioPage) {
    return <DominioPage />;
  }

  return <div dangerouslySetInnerHTML={{ __html: contentHtml }} />;
}

