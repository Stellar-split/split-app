const nextJest = require("next/jest");

const createJestConfig = nextJest({ dir: "./" });

/** @type {import("jest").Config} */
const config = {
  testEnvironment: "jest-environment-jsdom",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  testMatch: [
    "**/__tests__/**/*.(test|spec).(ts|tsx)",
    "**/__tests__/**/*.(test|spec).(js|jsx)",
  ],
  testPathIgnorePatterns: ["/node_modules/", "/src/app/search/__tests__/"],
  collectCoverageFrom: [
    "src/components/**/*.{ts,tsx}",
    "src/lib/errors/**/*.{ts,tsx}",
    "src/lib/retry/**/*.{ts,tsx}",
    "src/lib/offline/**/*.{ts,tsx}",
    "src/lib/api/**/*.{ts,tsx}",
    "!src/components/**/*.d.ts",
    "!src/lib/**/*.d.ts",
    "!src/lib/**/index.ts",
  ],
  coverageThreshold: {
    global: { branches: 80, functions: 80, lines: 80, statements: 80 },
    "./src/lib/errors/": { branches: 85, functions: 85, lines: 85, statements: 85 },
    "./src/lib/retry/": { branches: 85, functions: 85, lines: 85, statements: 85 },
    "./src/lib/offline/": { branches: 80, functions: 80, lines: 80, statements: 80 },
  },
  coveragePathIgnorePatterns: ["/node_modules/", "/__tests__/", "/__mocks__/"],
  testTimeout: 10000,
  clearMocks: true,
  restoreMocks: true,
};

module.exports = createJestConfig(config);