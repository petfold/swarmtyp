import { useEffect, useRef } from 'react';
import * as Y from 'yjs';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { basicSetup } from 'codemirror';
import { indentWithTab } from '@codemirror/commands';
import { setDiagnostics, type Diagnostic as CmDiagnostic } from '@codemirror/lint';
import { yCollab } from 'y-codemirror.next';
import { typst } from './typst-mode';
import type { Diagnostic } from '../compile/protocol';

// One CodeMirror view per open file, bound to the file's Y.Text (D-03). Remote cursors come in Phase 2.
export function Editor({ ytext, path, diagnostics }: { ytext: Y.Text; path: string; diagnostics: Diagnostic[] }) {
  const host = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  useEffect(() => {
    if (!host.current) return;
    const undoManager = new Y.UndoManager(ytext);
    const view = new EditorView({
      state: EditorState.create({
        doc: ytext.toString(),
        extensions: [basicSetup, keymap.of([indentWithTab]), typst, EditorView.lineWrapping, yCollab(ytext, null as never, { undoManager })],
      }),
      parent: host.current,
    });
    viewRef.current = view;
    return () => { view.destroy(); viewRef.current = null; undoManager.destroy(); };
  }, [ytext]);

  useEffect(() => {
    const view = viewRef.current; if (!view) return;
    const doc = view.state.doc;
    const own = diagnostics.filter((d) => d.path === path && d.severity !== 'hint');
    const cm: CmDiagnostic[] = [];
    for (const d of own) {
      const m = /^(\d+):(\d+)-(\d+):(\d+)$/.exec(d.range); if (!m) continue;
      const pos = (line: number, col: number) => { const l = doc.line(Math.min(line + 1, doc.lines)); return Math.min(l.from + col, l.to); };
      const from = pos(+m[1], +m[2]); const to = Math.max(from, pos(+m[3], +m[4]));
      cm.push({ from, to, severity: d.severity === 'warning' ? 'warning' : 'error', message: d.message });
    }
    view.dispatch(setDiagnostics(view.state, cm));
  }, [diagnostics, path]);

  return <div ref={host} className="editor-host" />;
}
