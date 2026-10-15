/**
 * Ambient declarations for the classic-script globals defined in studio.js.
 * They are real global bindings in the page context (not window properties),
 * which is why `page.evaluate` can reference them directly.
 */
declare global {
  interface StudioSlide {
    id: string;
    uid: string;
    format: string;
    theme: string;
    customWidth: number;
    customHeight: number;
    series: string;
    caption: string;
    image: string | null;
    [key: string]: unknown;
  }

  const SAMPLES: Array<{ id: string; name: string; category: string; desc: string }>;
  const FORMATS: Array<{ id: string; label: string; w: number; h: number }>;
  const SERIES_PACKS: Array<{
    id: string;
    name: string;
    desc: string;
    theme: string;
    pattern: string;
    slides: string[];
  }>;

  function NEW_SLIDE(id: string): StudioSlide;
  function frame(
    ctx: CanvasRenderingContext2D,
    slide: StudioSlide,
    index: number,
    total: number,
    opts?: { guides?: boolean },
  ): void;
  function getFormat(slide: StudioSlide): { id: string; label: string; w: number; h: number };
  function setSlideProp(key: string, value: unknown): void;
  function renderSeries(): void;
  function restoreFrom(text: string): { name: string; seriesPack: string; selected: number; slides: StudioSlide[] };

  let app: { name: string; seriesPack: string; selected: number; slides: StudioSlide[] };
}

export {};
