import { expect } from 'chai';
import * as path from 'path';
import * as fs from 'fs';
import * as prettier from 'prettier';
import * as plugin from '../src';

const PARAGRAPH_SPLITTER = /(?:\r?\n){2,}(?=\/\/|It|When|If|<)/i;
// const CHUNK_OPTIONS = /(\w+): ([^\s]*)/g

const TEST_MESSAGE = /^(\/\/|It|When|If)[^<{]*/i;

export function assertFormattedEqualsFixed(dirname: string, options = {}) {
  const source = readFile(dirname, 'index.liquid');
  const expectedResults = readFile(dirname, 'fixed.liquid');

  const chunks = source.split(PARAGRAPH_SPLITTER);
  const expectedChunks = expectedResults.split(PARAGRAPH_SPLITTER);
  for (let i = 0; i < chunks.length; i++) {
    const src = chunks[i];
    const expected = expectedChunks[i].trimEnd();
    const actual = format(src, options).trimEnd();
    const testMessage = TEST_MESSAGE.exec(expected) || [
      `it should format as expected (chunk ${i})`,
    ];
    it(testMessage[0].replace(/^\/\/\s*/, '').replace(/\r?\n/g, ' '), () => {
      try {
        expect(
          actual.replace(TEST_MESSAGE, ''),
          '\n      ########## INPUT\n      ' +
            src.replace(TEST_MESSAGE, '').replace(/\n/g, '\n      ').trimEnd() +
            '\n      ##########\n',
        ).to.eql(expected.replace(TEST_MESSAGE, ''));
      } catch (e) {
        // Improve the stack trace so that it points to the fixed file instead
        // of this test-helper file. Might make navigation smoother.
        if ((e as any).stack as any) {
          (e as any).stack = ((e as any).stack as string).replace(
            /^(\s+)at Context.<anonymous> \(.*:\d+:\d+\)/im,
            [
              `$1at expected.liquid (${path.join(
                dirname,
                'fixed.liquid',
              )}:${diffLoc(
                expected,
                actual,
                lineOffset(expectedResults, expected),
              ).join(':')})`,
              `$1at input.liquid (${path.join(dirname, 'index.liquid')}:1:1)`,
              `$1at assertFormattedEqualsFixed (${path.join(
                dirname,
                'index.spec.ts',
              )}:5:6)`,
            ].join('\n'),
          );
        }

        throw e;
      }
    });
  }
}

function lineOffset(source: string, needle: string): number {
  return (source.slice(0, source.indexOf(needle)).match(/\n/g) || []).length;
}

function diffLoc(expected: string, actual: string, offset: number) {
  // assumes there's a diff.
  let line = 1;
  let col = 0;
  for (let i = 0; i < expected.length; i++) {
    if (expected[i] === '\n') {
      line += 1;
      col = 0;
    }
    col += 1;
    if (expected[i] !== actual[i]) break;
  }
  return [offset + line, col];
}

export function readFile(dirname: string, filename: string) {
  return fs.readFileSync(path.join(dirname, filename), 'utf8');
}

export function writeFile(dirname: string, filename: string, contents: string) {
  return fs.writeFileSync(path.join(dirname, filename), contents, 'utf8');
}

export function format(content: string, options: any) {
  return prettier.format(content, {
    ...options,
    parser: 'liquid-html',
    plugins: [plugin],
  });
}

/**
 * Lets you write "magic" string literals that are "reindented" similar to Ruby's <<~
 * So you can write
 *
 * const input = reindent`
 *   function() {
 *     foo();
 *   }
 * `;
 *
 * And it will be as though function() was at indent 0 and foo was indent 1.
 */
export function reindent(
  strs: TemplateStringsArray,
  ...keys: any[] | undefined
): string {
  const s = strs.reduce((acc, next, i) => {
    if (keys[i] !== undefined) {
      return acc + next + keys[i];
    }
    return acc + next;
  }, '');
  const lines = s.replace(/^\r?\n|\s+$/g, '').split(/\r?\n/);
  const minIndentLevel = lines
    .filter((line) => line.trim().length > 0)
    .map((line) => (line.match(/^\s*/) as any)[0].length)
    .reduce((a, b) => Math.min(a, b), Infinity);

  if (minIndentLevel === Infinity) {
    return lines.join('\n');
  }

  const indentStrip = ' '.repeat(minIndentLevel);
  return lines
    .map((line) => line.replace(indentStrip, ''))
    .map((s) => s.trimEnd())
    .join('\n');
}
