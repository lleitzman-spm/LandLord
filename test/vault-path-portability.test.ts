import { describe, expect, it } from 'vitest';
import {
  makeNode,
  moduleNodeFor,
  normalizeGraphId,
  normalizeRepoPath,
  resolveImport,
} from '../tools/vault/lib.mjs';

describe('Great Book repository path identity', () => {
  it('writes one POSIX identity for slash and backslash spellings', () => {
    expect(normalizeRepoPath('.\\src\\domain\\flows.ts')).toBe('src/domain/flows.ts');
    expect(normalizeRepoPath('./src/domain/flows.ts')).toBe('src/domain/flows.ts');
    expect(normalizeGraphId('module:src\\domain\\flows.ts')).toBe('module:src/domain/flows.ts');

    const slash = makeNode({ id: 'module:src/domain/flows.ts', type: 'module' });
    const backslash = makeNode({
      id: 'module:src\\domain\\flows.ts',
      type: 'module',
      source_path: 'src\\domain\\flows.ts',
      edges: [{ to: 'module:src\\domain\\events.ts', why: 'fixture import' }],
    });

    expect(backslash.id).toBe(slash.id);
    expect(backslash.source_path).toBe('src/domain/flows.ts');
    expect(backslash.edges[0].to).toBe('module:src/domain/events.ts');
  });

  it('resolves an import when its importer arrives with Windows separators', () => {
    expect(resolveImport('src\\domain\\flows.ts', '.\\events')).toBe('src/domain/events.ts');
  });

  it('preserves module import roads when a file arrives with Windows separators', () => {
    const app = moduleNodeFor('src\\App.tsx', new Map());
    expect(app).toBeDefined();
    expect(app?.id).toBe('module:src/App.tsx');
    expect(app?.edges.map((edge) => edge.to)).toContain('module:src/domain/court.ts');
    expect(app?.extra.assets).toContain('src/App.css');
  });
});
