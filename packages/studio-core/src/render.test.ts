import { describe, expect, it } from 'vitest';
import { configureRenderer, frame } from './render.js';
import { NEW_SLIDE } from './registry.js';

/**
 * Contract tests for the extracted renderer (P1, blueprint 8.1 step 3).
 *
 * The renderer must be DOM-free and receive images/logos through
 * configureRenderer(); the offline editor wires them to its real caches, a
 * server-side consumer can wire different sources. Rendering itself is pinned
 * byte-for-byte by the real-browser goldens; these tests pin the wiring.
 */

interface MockCtx {
  calls: { fillText: number; drawImage: number; texts: string[] };
  canvas: { width: number; height: number };
}

function createCtx(): CanvasRenderingContext2D & MockCtx {
  const texts: string[] = [];
  let drawImageCalls = 0;
  const ctx: Record<string, unknown> = {
    canvas: { width: 0, height: 0 },
    calls: {
      fillText: 0,
      get drawImage() {
        return drawImageCalls;
      },
      texts,
    },
    save() {},
    restore() {},
    scale() {},
    fillRect() {},
    strokeRect() {},
    beginPath() {},
    rect() {},
    clip() {},
    arc() {},
    roundRect() {},
    fill() {},
    stroke() {},
    moveTo() {},
    lineTo() {},
    setLineDash() {},
    drawImage() {
      drawImageCalls += 1;
    },
    measureText(s: string) {
      const size = Number(String((this as { font?: string }).font ?? '').match(/(\d+(?:\.\d+)?)px/)?.[1] ?? 20);
      return { width: String(s).length * size * 0.51 };
    },
    fillText(s: string, x: number, y: number) {
      if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error('invalid canvas coord');
      texts.push(String(s));
      (ctx.calls as { fillText: number }).fillText += 1;
    },
  };
  return ctx as unknown as CanvasRenderingContext2D & MockCtx;
}

const fakeImage = { width: 20, height: 10 } as unknown as CanvasImageSource;

describe('studio-core renderer (DOM-free)', () => {
  it('draws a slide without any DOM, setting canvas dimensions from the format', () => {
    const ctx = createCtx();
    const slide = NEW_SLIDE('cover');
    frame(ctx, slide as never, 0, 1);
    expect(ctx.calls.fillText).toBeGreaterThan(0);
    expect(ctx.canvas.width).toBe(1080);
    expect(ctx.canvas.height).toBe(1350);
  });

  it('honours custom dimensions', () => {
    const ctx = createCtx();
    const slide = NEW_SLIDE('cover') as Record<string, unknown>;
    slide.format = 'custom';
    slide.customWidth = 800;
    slide.customHeight = 1000;
    frame(ctx, slide as never, 0, 1);
    expect(ctx.canvas.width).toBe(800);
    expect(ctx.canvas.height).toBe(1000);
  });

  it('uses injected images and logos instead of DOM image loading', () => {
    const slide = NEW_SLIDE('image') as Record<string, unknown>;
    slide.image = 'data:image/png;base64,AAAA';

    // Without injection: dashed placeholder, no drawImage for the photo.
    configureRenderer({ getLogo: () => null, getImage: () => null });
    const bare = createCtx();
    frame(bare, slide as never, 0, 1);
    expect(bare.calls.texts.some((t) => t.includes('ADD REAL SCREENSHOT'))).toBe(true);

    // With injection: the image is drawn and the placeholder is not.
    const lookedUp: string[] = [];
    configureRenderer({
      getLogo: (key) => {
        lookedUp.push(`logo:${key}`);
        return fakeImage;
      },
      getImage: (src) => {
        lookedUp.push(`image:${src}`);
        return fakeImage;
      },
    });
    const wired = createCtx();
    frame(wired, slide as never, 0, 1);
    expect(lookedUp).toContain('image:data:image/png;base64,AAAA');
    expect(lookedUp.some((k) => k.startsWith('logo:'))).toBe(true);
    expect(wired.calls.drawImage).toBeGreaterThan(0);
    expect(wired.calls.texts.some((t) => t.includes('ADD REAL SCREENSHOT'))).toBe(false);

    // Reset for other tests in this file.
    configureRenderer({ getLogo: () => null, getImage: () => null });
  });
});
