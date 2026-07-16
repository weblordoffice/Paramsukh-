export default {
  testEnvironment: 'node',
  transform: {},
  extensionsToTreatAsEsm: [],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^dompurify$': '<rootDir>/src/__tests__/__mocks__/dompurify.js',
    '^jsdom$': '<rootDir>/src/__tests__/__mocks__/jsdom.js',
  },
  setupFiles: ['<rootDir>/src/__tests__/setup.cjs'],
  testMatch: ['<rootDir>/src/__tests__/**/*.test.js'],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/__tests__/**',
    '!src/scripts/**',
    '!src/config/admin.js',
  ],
  coverageDirectory: 'coverage',
  verbose: true,
  testTimeout: 30000,
  transformIgnorePatterns: [],
};
