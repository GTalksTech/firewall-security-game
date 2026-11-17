// Minimal test harness shared by the browser runner and the command-line runner.

const tests = [];

export function test(name, fn) {
  tests.push({ name, fn });
}

export function assert(condition, message) {
  if (!condition) throw new Error(message || 'assertion failed');
}

export function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(
      `${message ? message + ': ' : ''}expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
    );
  }
}

export function assertDeepEqual(actual, expected, message) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    throw new Error(`${message ? message + ': ' : ''}expected ${e}, got ${a}`);
  }
}

export async function run() {
  const failed = [];
  let passed = 0;
  for (const t of tests) {
    try {
      await t.fn();
      passed += 1;
    } catch (err) {
      failed.push({ name: t.name, message: err && err.message ? err.message : String(err) });
    }
  }
  return { total: tests.length, passed, failed };
}

// Loads every suite, registers its tests against the content, and runs them.
// A suite that cannot be imported is reported as a failed test, never skipped.
export async function runSuites(suiteNames, importSuite, content) {
  for (const name of suiteNames) {
    try {
      const mod = await importSuite(name);
      mod.register(content);
    } catch (err) {
      test(`load ${name}`, () => {
        throw new Error(`could not load suite: ${err && err.message ? err.message : err}`);
      });
    }
  }
  const result = await run();
  if (result.total === 0) {
    result.failed.push({ name: 'no tests found', message: 'zero tests ran; this counts as a failure' });
  }
  return result;
}

export const SUITES = ['rules.test.js', 'content.test.js', 'state.test.js', 'arcade.test.js'];
