import { describe, expect, it } from 'vitest';

const FORBIDDEN_IMPORTS = [
  /^react(?:\/|$)/,
  /^react-dom(?:\/|$)/,
  /^(?:node:)?fs(?:\/|$)/,
  /^(?:node:)?path(?:\/|$)/,
  /^(?:node:)?http(?:\/|$)/,
  /^(?:node:)?https(?:\/|$)/,
  /^(?:node:)?net(?:\/|$)/,
  /^(?:node:)?tls(?:\/|$)/,
  /^(?:node:)?child_process$/,
  /^(?:node:)?process$/,
];

const FORBIDDEN_GLOBALS = [
  /\bwindow\./,
  /\bdocument\./,
  /\blocalStorage\./,
  /\bsessionStorage\./,
  /\bindexedDB\./,
  /\bfetch\(/,
  /\bXMLHttpRequest\(/,
  /\bWebSocket\(/,
  /\bnavigator\./,
];

const IMPORT_SPECIFIER = /\b(?:import|export)\s+(?:type\s+)?(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)|require\(\s*['"]([^'"]+)['"]\s*\)/g;
const CORE_SOURCES = import.meta.glob('../src/core/**/*.ts', {
  eager: true,
  import: 'default',
  query: '?raw',
}) as Readonly<Record<string, string>>;

describe('src/core import boundary', () => {
  it('keeps pure core free of React, DOM, storage, network, and runtime I/O dependencies', () => {
    const violations = Object.entries(CORE_SOURCES).flatMap(([path, source]) => {
      const importedModules = [...source.matchAll(IMPORT_SPECIFIER)]
        .map((match) => match[1] ?? match[2] ?? match[3])
        .filter((specifier): specifier is string => specifier !== undefined);
      const forbiddenImports = importedModules.filter((specifier) =>
        FORBIDDEN_IMPORTS.some((forbiddenImport) => forbiddenImport.test(specifier)),
      );
      const forbiddenGlobals = FORBIDDEN_GLOBALS.filter((forbiddenGlobal) => forbiddenGlobal.test(source)).map(
        (forbiddenGlobal) => forbiddenGlobal.source,
      );

      return [...forbiddenImports, ...forbiddenGlobals].map((violation) => `${path}: ${violation}`);
    });

    expect(violations).toEqual([]);
  });
});
