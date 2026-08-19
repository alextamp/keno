/** Scoped to this directory only — does not touch or run against app/src.
 *  See firestore-tests/README.md for how to run these. */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['**/*.test.ts'],
  testTimeout: 20000,
};
