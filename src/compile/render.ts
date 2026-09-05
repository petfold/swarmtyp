// Renderer bridge (D-17): one typst.ts render session, canvas per visible page with an explicit 2D context
// (an element panics the renderer, typst.ts #888; renderToCanvas waits for frames, #889).
import { createTypstRenderer, type RenderSession, type TypstRenderer } from '@myriaddreamin/typst.ts';
import rendererWasmUrl from '@myriaddreamin/typst-ts-renderer/pkg/typst_ts_renderer_bg.wasm?url';
import { fetchRanged } from './ranged';
import { cachedBytes, putBytes } from './asset-cache';
import { COMPILER_VERSION } from './client';

export interface PageInfo { pageOffset: number; width: number; height: number }

export class PageRenderer {
  private renderer: TypstRenderer | null = null;
  private session: RenderSession | null = null;
  private release: (() => void) | null = null;
  pages: PageInfo[] = [];

  async init() {
    const r = createTypstRenderer();
    // Ranged fetch + compile: a whole-body fetch of the 1 MB renderer is truncated by Freedom's Ant (S1).
    const key = `renderer/${COMPILER_VERSION}`;
    let bytes = await cachedBytes(key);
    if (!bytes) { bytes = await fetchRanged(new URL(rendererWasmUrl, document.baseURI).href); void putBytes(key, bytes); }
    const wasm = await WebAssembly.compile(bytes as BufferSource);
    await r.init({ getModule: () => wasm, beforeBuild: [] });
    this.renderer = r;
    // Keep one session alive for the lifetime of the renderer (runWithSession frees it when the callback returns).
    await new Promise<void>((resolve) => {
      r.runWithSession(async (session) => { this.session = session; resolve(); await new Promise<void>((done) => { this.release = done; }); });
    });
  }

  /** Load a new vector artifact (full replace; incremental merge is a later step). */
  setArtifact(artifact: Uint8Array) {
    if (!this.renderer || !this.session) throw new Error('renderer not ready');
    this.renderer.manipulateData({ renderSession: this.session, action: 'reset', data: artifact });
    this.pages = this.renderer.retrievePagesInfoFromSession(this.session) as PageInfo[];
  }

  async renderPage(canvas: HTMLCanvasElement, pageOffset: number, pixelPerPt: number) {
    if (!this.renderer || !this.session) return;
    const page = this.pages[pageOffset]; if (!page) return;
    const w = Math.ceil(page.width * pixelPerPt), h = Math.ceil(page.height * pixelPerPt);
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    (this.session as unknown as { pixelPerPt: number; backgroundColor: string }).pixelPerPt = pixelPerPt;
    (this.session as unknown as { backgroundColor: string }).backgroundColor = '#ffffff';
    await this.renderer.renderCanvas({ renderSession: this.session, canvas: ctx, pageOffset, pixelPerPt, backgroundColor: '#ffffff', dataSelection: { body: true, semantics: false } } as never);
  }

  /** SVG of the whole document, for export only (T5: never inserted into the app DOM unsanitised). */
  async renderSvg(artifact: Uint8Array): Promise<string> {
    if (!this.renderer) throw new Error('renderer not ready');
    return this.renderer.renderSvg({ artifactContent: artifact, format: 'vector' } as never);
  }

  destroy() { this.release?.(); this.session = null; }
}
