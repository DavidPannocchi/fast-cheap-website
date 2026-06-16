import { initLegacyBehavior, cleanupLegacyBehavior } from './legacyBehavior.js';

const appRoot = document.body;

initLegacyBehavior();

window.addEventListener('beforeunload', () => {
  cleanupLegacyBehavior();
});
