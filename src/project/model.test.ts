import { describe, it, expect } from 'vitest';
import * as Y from 'yjs';
import { initProject, addTextFile, addBlob, renameFile, removeFile, snapshot, meta, normalizePath } from './model';

describe('project model', () => {
  it('initialises once and snapshots texts and blobs', () => {
    const doc = new Y.Doc();
    initProject(doc, 'Demo', '= Hello');
    initProject(doc, 'Again', 'ignored');
    addTextFile(doc, 'chapters/one.typ', '== One');
    addBlob(doc, 'img/logo.png', 'ab'.repeat(32), 'image/png', 1234);
    const s = snapshot(doc);
    expect(meta(doc).name).toBe('Demo');
    expect(s.mainFile).toBe('/main.typ');
    expect(s.texts['/main.typ']).toBe('= Hello');
    expect(s.texts['/chapters/one.typ']).toBe('== One');
    expect(s.blobs['/img/logo.png']).toBe('ab'.repeat(32));
  });
  it('renames text files and follows the main file', () => {
    const doc = new Y.Doc();
    initProject(doc, 'Demo', 'body');
    renameFile(doc, '/main.typ', 'index.typ');
    expect(meta(doc).mainFile).toBe('/index.typ');
    expect(snapshot(doc).texts['/index.typ']).toBe('body');
    expect(snapshot(doc).texts['/main.typ']).toBeUndefined();
    removeFile(doc, '/index.typ');
    expect(Object.keys(snapshot(doc).texts)).toHaveLength(0);
  });
  it('normalises paths', () => { expect(normalizePath('a//b.typ')).toBe('/a/b.typ'); expect(normalizePath('/x')).toBe('/x'); });
});
