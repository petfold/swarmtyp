import { useEffect, useMemo, useRef, useState } from 'react';
import type { PageRenderer } from '../compile/render';

// Canvas per page; only pages intersecting the scroll viewport are rendered (D-17, S10).
export function Preview({ renderer, version, zoom }: { renderer: PageRenderer | null; version: number; zoom: number }) {
  const scroller = useRef<HTMLDivElement>(null);
  const canvases = useRef(new Map<number, HTMLCanvasElement>());
  const [visible, setVisible] = useState<Set<number>>(new Set());
  const pages = renderer?.pages ?? [];
  const dpr = typeof devicePixelRatio === 'number' ? devicePixelRatio : 1;
  const ppp = useMemo(() => Math.min(4, Math.max(0.5, zoom * dpr)), [zoom, dpr]);

  useEffect(() => {
    if (!scroller.current) return;
    const io = new IntersectionObserver((entries) => {
      setVisible((prev) => { const next = new Set(prev); for (const e of entries) { const i = Number((e.target as HTMLElement).dataset.page); if (e.isIntersecting) next.add(i); else next.delete(i); } return next; });
    }, { root: scroller.current, rootMargin: '50% 0px' });
    for (const c of canvases.current.values()) io.observe(c);
    return () => io.disconnect();
  }, [pages.length]);

  useEffect(() => {
    if (!renderer) return;
    let cancelled = false;
    (async () => {
      for (const i of Array.from(visible).sort((a, b) => a - b)) {
        const c = canvases.current.get(i); if (!c || cancelled) continue;
        await renderer.renderPage(c, i, ppp);
      }
    })();
    return () => { cancelled = true; };
  }, [renderer, version, visible, ppp]);

  return (
    <div className="preview" ref={scroller}>
      {pages.map((p) => (
        <canvas key={p.pageOffset} data-page={p.pageOffset} className="page"
          ref={(el) => { if (el) canvases.current.set(p.pageOffset, el); else canvases.current.delete(p.pageOffset); }}
          style={{ width: p.width * zoom, height: p.height * zoom }} />
      ))}
      {pages.length === 0 && <div className="preview-empty">No pages yet</div>}
    </div>
  );
}
