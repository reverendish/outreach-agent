/** @type {import('jest').Config} */
export default {
  // Run tests in Node (not jsdom) — these are Lambda handlers
  testEnvironment: 'node',
  // Jest doesn't support ES modules natively — we use the experimental VM mode.
  // Run tests with: NODE_OPTIONS=--experimental-vm-modules jest
  transform: {},
  // Match __tests__/**/*.test.js
  testMatch: ['**/__tests__/**/*.test.js'],
  // Collect coverage from all Lambda handler files
  collectCoverageFrom: [
    '*.js',
    '!jest.config.mjs',
  ],
};
