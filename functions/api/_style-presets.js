// _style-presets.js
// Unica fonte di verità per i preset di stile usati nella generazione dei siti clienti.
// Logica identica alla versione Netlify — qui cambia solo la sintassi dei moduli
// (import/export invece di require/module.exports), richiesta dal runtime
// Cloudflare Workers su cui girano le Pages Functions.

export const STYLE_PRESETS = {
  minimal: {
    label: 'Minimal',
    palette: '#FFFFFF (sfondo), #111111 (testo), #F5F5F3 (sezioni alternate), #2B2B2B (accento)',
    fonts: 'Inter (corpo) + Fraunces (titoli)',
    variants: {
      A: {
        label: 'Editoriale',
        layout: 'Asimmetrico: testo allineato a sinistra (mai centrato), molto white space verticale tra le sezioni, bordi 1px invece di card piene, nessuna ombra.',
      },
      B: {
        label: 'Grid',
        layout: 'Griglia centrata e strutturata, colonne regolari, sottili linee divisorie orizzontali tra sezioni invece di bordi sui blocchi.',
      },
    },
  },
  bold: {
    label: 'Deciso & Bold',
    palette: '#0A0A0A (sfondo scuro), #FFE500 (accento acceso), #FFFFFF (testo/contrasto)',
    fonts: 'Archivo Black (titoli) + Space Grotesk (corpo)',
    variants: {
      A: {
        label: 'Full-bleed',
        layout: 'Blocchi di colore pieno che escono dal margine (full-bleed), tipografia enorme come elemento grafico principale, zero border-radius, CTA giganti.',
      },
      B: {
        label: 'Split-screen',
        layout: 'Sezioni divise in due metà con blocchi di colore alternati lato sinistro/destro, disposizione diagonale nei separatori tra sezioni.',
      },
    },
  },
  elegante: {
    label: 'Elegante',
    palette: '#1C1C1C (testo), #C9A876 (oro, solo per dettagli/linee, mai come sfondo pieno), #FAF7F2 (sfondo crema)',
    fonts: 'Cormorant Garamond (titoli) + Work Sans (corpo)',
    variants: {
      A: {
        label: 'Editoriale',
        layout: 'Hero split: immagine a sinistra, testo a destra (o viceversa). Colonne asimmetriche nelle sezioni successive. Mai icone o emoji — solo tipografia e linee sottili come elementi decorativi.',
      },
      B: {
        label: 'Full-bleed',
        layout: 'Hero a piena larghezza con immagine di sfondo e testo centrato sopra. Sezioni impilate a piena larghezza, non a colonne. Mai icone o emoji.',
      },
    },
  },
  fresco: {
    label: 'Fresco & Colorato',
    palette: '#FF6B6B, #4ECDC4, #FFE66D, #FFFFFF (sfondo)',
    fonts: 'Quicksand (titoli) + Nunito Sans (corpo)',
    variants: {
      A: {
        label: 'Organico',
        layout: 'Forme organiche/blob come divisori tra sezioni (SVG), illustrazioni al posto di foto stock dove possibile, angoli molto arrotondati (min 24px).',
      },
      B: {
        label: 'Mosaico',
        layout: 'Griglia a mosaico con card di dimensioni diverse (non tutte uguali), foto reali con bordi arrotondati, disposizione asimmetrica ma ordinata.',
      },
    },
  },
  caldo: {
    label: 'Caldo & Accogliente',
    palette: '#8B5A3C (terracotta), #F4E9DA (crema), #5C7A5C (verde salvia, accento)',
    fonts: 'Lora (titoli) + Karla (corpo)',
    variants: {
      A: {
        label: 'Artigianale',
        layout: 'Layout non a griglia perfetta, leggermente "fatto a mano": foto con bordi irregolari o stile Polaroid, texture leggera di sfondo, disposizione asimmetrica.',
      },
      B: {
        label: 'Rivista calda',
        layout: 'Struttura più organizzata in stile rivista, colonne regolari ma con toni e texture calde, foto con bordi netti (non Polaroid).',
      },
    },
  },
};

export const ANTI_AI_LOOK_RULES = [
  'Hero con blob sfumato viola-blu/gradiente generico sullo sfondo',
  'Bottone CTA con testo generico tipo "Get Started" o "Scopri di più" senza azione specifica',
  'Griglia di 3 card identiche (icona + titolo + una riga di testo) usata come sezione "servizi" di default',
  'Gradient come sfondo principale, salvo che il preset lo preveda esplicitamente (Fresco)',
  'Emoji usate come icone in contesti professionali (vietate sempre in Minimal ed Elegante)',
  'Sezione "Perché scegliere noi" con lista di checkmark verdi',
  'Testi vaghi e generici tipo "La qualità al primo posto" o "Passione e professionalità" invece di contenuti specifici del cliente',
  'Carosello testimonial con 5 stelle piene su ogni singola recensione senza variazione',
];

export function resolveVariant(orderId) {
  const digits = String(orderId).replace(/\D/g, '');
  const lastDigit = digits.length ? Number(digits[digits.length - 1]) : 0;
  return lastDigit % 2 === 0 ? 'A' : 'B';
}

const SECTOR_TO_PRESET_FALLBACK = {
  ristorante: 'caldo',
  pizzeria: 'caldo',
  bar: 'caldo',
  parrucchiere: 'fresco',
  estetista: 'fresco',
  centro_estetico: 'fresco',
  palestra: 'bold',
  personal_trainer: 'bold',
  studio_legale: 'elegante',
  studio_architettura: 'elegante',
  gioielleria: 'elegante',
  artigiano: 'minimal',
  freelance: 'minimal',
  negozio: 'fresco',
  asilo_nido: 'fresco',
  default: 'minimal',
};

export function resolvePresetForSector(settore) {
  const key = String(settore || '').toLowerCase().trim().replace(/\s+/g, '_');
  return SECTOR_TO_PRESET_FALLBACK[key] || SECTOR_TO_PRESET_FALLBACK.default;
}
