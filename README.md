# fast-cheap-website

Un sito web configurabile per servizi professionali veloci e convenienti.

## Setup Locale

```bash
npm install
npm run dev
```

Visita: http://localhost:5173

## Build per Produzione

```bash
npm run build
npm run preview
```

## Deploy su GitHub Pages

Il deployment è **automatico**:
1. Fai un commit con le tue modifiche
2. Fai un push su GitHub (`git push`)
3. GitHub Actions compila e deploya automaticamente in ~2 minuti

Visita il sito su: https://DavidPannocchi.github.io/fast-cheap-website/

## Configurazione GitHub Pages (se necessario)

Se il sito non appare online:
1. Vai su: Settings → Pages
2. Build and deployment → Source: "GitHub Actions"
3. Salva

## Struttura Progetto

```
src/
├── main.jsx          # Entry point React
├── App.jsx           # Componente principale
├── content.html      # HTML del sito
├── legacyBehavior.js # JavaScript interattivo
└── styles.css        # CSS

dist/                 # Build di produzione (generato automaticamente)
.github/workflows/    # GitHub Actions automation
```

## Stack Tecnologico

- **React** - UI framework
- **Vite** - Build tool ultra-veloce
- **Vanilla JS** - Interattività legacy
- **CSS Puro** - Styling

## Note

- La cartella `dist/` viene generata automaticamente dal build
- Non committare `dist/` — viene rigenerata per ogni deploy
- Le modifiche a `src/` vengono compilate automaticamente dal workflow
