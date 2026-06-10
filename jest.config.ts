import type { Config } from 'jest';
import nextJest from 'next/jest.js';

const createJestConfig = nextJest({ dir: './' });

const config: Config = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testMatch: ['**/__tests__/**/*.test.{ts,tsx}'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  // Exclude SAM build artifacts — they contain duplicate package.json files
  // that cause haste module naming collisions.
  modulePathIgnorePatterns: [
    '<rootDir>/infrastructure/.aws-sam/',
    '<rootDir>/src/lambda/',
  ],
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/infrastructure/',
    '<rootDir>/src/lambda/',
    '<rootDir>/.next/',
  ],
};

export default createJestConfig(config);
