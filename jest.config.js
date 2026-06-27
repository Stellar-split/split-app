const nextJest = require("next/jest");

const createJestConfig = nextJest({ dir: "./" });

/** @type {import("jest").Config} */
const config = {
  testEnvironment: "jest-environment-jsdom",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  testMatch: ["**/__tests__/**/*.(test|spec).(ts|tsx)"],
  testPathIgnorePatterns: ["/node_modules/", "/src/app/search/__tests__/"],
  collectCoverageFrom: ["src/components/**/*.{ts,tsx}", "!src/components/**/*.d.ts"],
  coverageThreshold: { global: { branches: 80, functions: 80, lines: 80, statements: 80 } },
};

module.exports = createJestConfig(config);
