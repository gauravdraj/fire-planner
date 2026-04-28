import { beforeEach, describe, expect, it } from 'vitest';

import { setMockPrefersColorSchemeDark } from '@/test/matchMediaMock';

import indexHtml from '../../index.html?raw';
import { installMemoryLocalStorage } from '../store/memoryStorage';

describe('index theme bootstrap', () => {
  beforeEach(() => {
    installMemoryLocalStorage();
  });

  it('runs before the bundled React entrypoint', () => {
    const html = readIndexHtml();
    const bootstrapIndex = html.indexOf('<script>');
    const moduleIndex = html.indexOf('<script type="module" src="/src/main.tsx"></script>');

    expect(bootstrapIndex).toBeGreaterThanOrEqual(0);
    expect(moduleIndex).toBeGreaterThan(bootstrapIndex);
  });

  it('applies persisted dark preference to the root class synchronously', () => {
    window.localStorage.setItem('fire-planner.ui.v1', JSON.stringify({ themePreference: 'dark' }));

    runBootstrapScript();

    expect(document.documentElement).toHaveClass('dark');
    expect(document.documentElement.style.colorScheme).toBe('dark');
  });

  it('resolves system preference before React loads', () => {
    setMockPrefersColorSchemeDark(true);
    window.localStorage.setItem('fire-planner.ui.v1', JSON.stringify({ themePreference: 'system' }));

    runBootstrapScript();

    expect(document.documentElement).toHaveClass('dark');

    setMockPrefersColorSchemeDark(false);
    runBootstrapScript();

    expect(document.documentElement).not.toHaveClass('dark');
    expect(document.documentElement.style.colorScheme).toBe('light');
  });
});

function runBootstrapScript() {
  const script = extractBootstrapScript(readIndexHtml());

  new Function(script)();
}

function extractBootstrapScript(html: string) {
  const match = html.match(/<script>\s*([\s\S]*?)\s*<\/script>/);

  if (match?.[1] === undefined) {
    throw new Error('Theme bootstrap script is missing from index.html.');
  }

  return match[1];
}

function readIndexHtml() {
  return indexHtml;
}
