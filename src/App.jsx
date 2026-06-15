import { useEffect } from 'react';
import contentHtml from './content.html?raw';
import './styles.css';

export default function App() {
  useEffect(() => {
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
  }, []);

  return <div dangerouslySetInnerHTML={{ __html: contentHtml }} />;
}

