// Remote cursors as CodeMirror decorations, fed from the library's AWARENESS_UPDATED events (D-03, S5).
import { StateEffect, StateField, type Extension } from '@codemirror/state';
import { Decoration, EditorView, WidgetType, type DecorationSet } from '@codemirror/view';

export interface CursorInfo { address: string; name: string; anchor: number; head: number }
export const setRemoteCursors = StateEffect.define<CursorInfo[]>();

export function colorFor(address: string) { let h = 0; for (const c of address) h = (h * 31 + c.charCodeAt(0)) >>> 0; return `hsl(${h % 360} 70% 45%)`; }

class CaretWidget extends WidgetType {
  constructor(private name: string, private color: string) { super(); }
  eq(o: CaretWidget) { return o.name === this.name && o.color === this.color; }
  toDOM() {
    const el = document.createElement('span'); el.className = 'remote-caret'; el.style.borderLeftColor = this.color;
    const label = document.createElement('span'); label.className = 'remote-caret-label'; label.style.background = this.color; label.textContent = this.name; el.append(label);
    return el;
  }
  ignoreEvent() { return true; }
}

const field = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(deco, tr) {
    deco = deco.map(tr.changes);
    for (const e of tr.effects) if (e.is(setRemoteCursors)) {
      const len = tr.newDoc.length; const ranges = [];
      for (const c of e.value) {
        const head = Math.min(Math.max(0, c.head), len), anchor = Math.min(Math.max(0, c.anchor), len);
        const color = colorFor(c.address);
        if (anchor !== head) ranges.push(Decoration.mark({ attributes: { style: `background: ${color}33` } }).range(Math.min(anchor, head), Math.max(anchor, head)));
        ranges.push(Decoration.widget({ widget: new CaretWidget(c.name, color), side: 1 }).range(head));
      }
      deco = Decoration.set(ranges.sort((a, b) => a.from - b.from || (a.value.startSide - b.value.startSide)), true);
    }
    return deco;
  },
  provide: (f) => EditorView.decorations.from(f),
});

const theme = EditorView.baseTheme({
  '.remote-caret': { position: 'relative', borderLeft: '2px solid', marginLeft: '-1px', height: '1.2em', display: 'inline-block', verticalAlign: 'text-bottom' },
  '.remote-caret-label': { position: 'absolute', top: '-1.4em', left: '-2px', fontSize: '10px', lineHeight: '1.3', color: '#fff', padding: '0 4px', borderRadius: '3px', whiteSpace: 'nowrap', pointerEvents: 'none', opacity: '0.9' },
});

export function remoteCursors(): Extension { return [field, theme]; }
