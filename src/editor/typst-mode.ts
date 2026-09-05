// A small stream-parser highlighter for Typst markup, code and math. Enough for Phase 1; the compiler's semantic
// tokens (S2) can refine it later.
import { StreamLanguage, type StringStream } from '@codemirror/language';

interface State { math: boolean; block: number; raw: string | null }
const KEYWORDS = /^(let|set|show|import|include|if|else|for|in|while|break|continue|return|not|and|or|none|auto|true|false|context)\b/;

function token(stream: StringStream, st: State): string | null {
  if (st.raw !== null) { // inside ``` raw block
    if (stream.match(st.raw)) { st.raw = null; return 'monospace'; }
    stream.next(); return 'monospace';
  }
  if (st.block > 0) { // /* */ comment
    if (stream.match('*/')) st.block--; else if (stream.match('/*')) st.block++; else stream.next();
    return 'comment';
  }
  if (stream.match('/*')) { st.block = 1; return 'comment'; }
  if (stream.match('//')) { stream.skipToEnd(); return 'comment'; }
  if (stream.match(/^```[a-zA-Z0-9_-]*/)) { st.raw = '```'; return 'monospace'; }
  if (stream.match(/^`[^`]*`/)) return 'monospace';
  if (st.math) {
    if (stream.match('$')) { st.math = false; return 'special(string)'; }
    if (stream.match(/^[a-zA-Z][a-zA-Z0-9.]*/)) return 'variableName';
    if (stream.match(/^[0-9]+(\.[0-9]+)?/)) return 'number';
    stream.next(); return 'operator';
  }
  if (stream.match('$')) { st.math = true; return 'special(string)'; }
  if (stream.match(/^#(let|set|show|import|include|if|else|for|while|context|return)\b/)) return 'keyword';
  if (stream.match(/^#[a-zA-Z_][a-zA-Z0-9_-]*(\.[a-zA-Z_][a-zA-Z0-9_-]*)*/)) return 'function(variableName)';
  if (stream.sol() && stream.match(/^=+\s/)) return 'heading';
  if (stream.match(/^"(?:[^"\\]|\\.)*"/)) return 'string';
  if (stream.match(/^<[a-zA-Z0-9_:.-]+>/)) return 'labelName';
  if (stream.match(/^@[a-zA-Z0-9_:.-]+/)) return 'link';
  if (stream.match(/^\*[^*\n]+\*/)) return 'strong';
  if (stream.match(/^_[^_\n]+_/)) return 'emphasis';
  if (stream.match(KEYWORDS)) return 'keyword';
  if (stream.match(/^[0-9]+(\.[0-9]+)?(pt|mm|cm|in|em|%|fr|deg|rad)?/)) return 'number';
  if (stream.match(/^[{}()\[\]]/)) return 'bracket';
  if (stream.match(/^[=+\-*/<>!:;,.]/)) return 'operator';
  stream.next(); return null;
}

export const typst = StreamLanguage.define<State>({
  name: 'typst',
  startState: () => ({ math: false, block: 0, raw: null }),
  token,
  languageData: { commentTokens: { line: '//', block: { open: '/*', close: '*/' } } },
});
