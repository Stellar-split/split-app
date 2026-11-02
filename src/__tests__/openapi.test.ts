import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

/**
 * CI test that validates the OpenAPI specification and detects drift between
 * the documented paths/methods and the actual route handlers.
 *
 * It performs the following checks:
 *  1. The OpenAPI document is valid JSON and structurally sound.
 *  2. Required top-level fields are present (openapi, info, paths).
 *  3. Every operation has the required fields (responses, summary/description).
 *  4. Every operation includes request/response examples where applicable.
 *  5. Error scenarios are documented (4xx/5xx responses).
 *  6. Documented paths/methods match the actual route handlers (drift detection).
 */

const ROOT = path.resolve(__dirname, '..', '..');
const OPENAPI_PATH = path.join(ROOT, 'public', 'openapi.json');
const SRC_DIR = path.join(ROOT, 'src');

const HTTP_METHODS = [
  'get',
  'put',
  'post',
  'delete',
  'options',
  'head',
  'patch',
  'trace',
] as const;

type HttpMethod = (typeof HTTP_METHODS)[number];

interface OpenApiOperation {
  summary?: string;
  description?: string;
  operationId?: string;
  responses?: Record<string, unknown>;
  requestBody?: {
    content?: Record<string, { example?: unknown; examples?: Record<string, unknown> }>;
  };
  parameters?: Array<{ example?: unknown; examples?: Record<string, unknown> }>;
  [key: string]: unknown;
}

interface OpenApiDocument {
  openapi: string;
  info: { title: string; version: string; [key: string]: unknown };
  paths: Record<string, Record<string, OpenApiOperation>>;
  components?: Record<string, unknown>;
  [key: string]: unknown;
}

function loadOpenApi(): OpenApiDocument {
  expect(fs.existsSync(OPENAPI_PATH)).toBe(true);
  const raw = fs.readFileSync(OPENAPI_PATH, 'utf8');
  let parsed: unknown;
  expect(() => {
    parsed = JSON.parse(raw);
  }).not.toThrow();
  return parsed as OpenApiDocument;
}

/**
 * Recursively collect all source files under a directory.
 */
function collectSourceFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) {
    return [];
  }
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__' || entry.name === 'node_modules') {
        continue;
      }
      files.push(...collectSourceFiles(fullPath));
    } else if (/\.(ts|js)$/.test(entry.name) && !entry.name.endsWith('.d.ts')) {
      files.push(fullPath);
    }
  }
  return files;
}

interface DiscoveredRoute {
  method: HttpMethod;
  path: string;
}

/**
 * Extract routes from source files by scanning for common router/route
 * registration patterns, e.g.:
 *   router.get('/users/:id', ...)
 *   app.post("/users", ...)
 *   server.delete(`/users/:id`, ...)
 */
function discoverRoutes(files: string[]): DiscoveredRoute[] {
  const routes: DiscoveredRoute[] = [];
  const routeRegex = new RegExp(
    `\\b(?:router|app|server|route|api)\\.(${HTTP_METHODS.join('|')})\\s*\\(\\s*['"\`]([^'"\`]+)['"\`]`,
    'g',
  );

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    let match: RegExpExecArray | null;
    while ((match = routeRegex.exec(content)) !== null) {
      const method = match[1].toLowerCase() as HttpMethod;
      let routePath = match[2];
      // Normalize Express-style params (:id) to OpenAPI-style ({id}).
      routePath = routePath.replace(/:([A-Za-z0-9_]+)/g, '{$1}');
      // Strip trailing slashes (except root).
      if (routePath.length > 1 && routePath.endsWith('/')) {
        routePath = routePath.slice(0, -1);
      }
      routes.push({ method, path: routePath });
    }
  }
  return routes;
}

function normalizePath(p: string): string {
  let normalized = p.replace(/:([A-Za-z0-9_]+)/g, '{$1}');
  if (normalized.length > 1 && normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }
  return normalized;
}

function documentedRoutes(doc: OpenApiDocument): DiscoveredRoute[] {
  const routes: DiscoveredRoute[] = [];
  for (const [routePath, operations] of Object.entries(doc.paths)) {
    for (const method of Object.keys(operations)) {
      if ((HTTP_METHODS as readonly string[]).includes(method.toLowerCase())) {
        routes.push({
          method: method.toLowerCase() as HttpMethod,
          path: normalizePath(routePath),
        });
      }
    }
  }
  return routes;
}

function routeKey(route: DiscoveredRoute): string {
  return `${route.method.toUpperCase()} ${route.path}`;
}

describe('OpenAPI specification', () => {
  let doc: OpenApiDocument;

  beforeAll(() => {
    doc = loadOpenApi();
  });

  describe('schema validity', () => {
    it('is valid JSON with required top-level fields', () => {
      expect(doc).toBeDefined();
      expect(typeof doc.openapi).toBe('string');
      expect(doc.openapi).toMatch(/^3\.\d+\.\d+$/);
      expect(doc.info).toBeDefined();
      expect(typeof doc.info.title).toBe('string');
      expect(doc.info.title.length).toBeGreaterThan(0);
      expect(typeof doc.info.version).toBe('string');
      expect(doc.info.version.length).toBeGreaterThan(0);
      expect(doc.paths).toBeDefined();
      expect(typeof doc.paths).toBe('object');
    });

    it('defines at least one documented path', () => {
      expect(Object.keys(doc.paths).length).toBeGreaterThan(0);
    });

    it('uses valid path templates', () => {
      for (const routePath of Object.keys(doc.paths)) {
        expect(routePath.startsWith('/')).toBe(true);
        // Balanced braces for path parameters.
        const open = (routePath.match(/\{/g) || []).length;
        const close = (routePath.match(/\}/g) || []).length;
        expect(open).toBe(close);
      }
    });
  });

  describe('operation documentation', () => {
    it('every operation has required fields', () => {
      for (const [routePath, operations] of Object.entries(doc.paths)) {
        for (const [method, operation] of Object.entries(operations)) {
          if (!(HTTP_METHODS as readonly string[]).includes(method.toLowerCase())) {
            continue;
          }
          const context = `${method.toUpperCase()} ${routePath}`;
          expect(operation.responses).toBeDefined();
          expect(Object.keys(operation.responses ?? {}).length).toBeGreaterThan(0);
          const hasSummaryOrDescription =
            (typeof operation.summary === 'string' && operation.summary.length > 0) ||
            (typeof operation.description === 'string' && operation.description.length > 0);
          expect(hasSummaryOrDescription).toBe(true);
          // Ensure the operation is identifiable.
          expect(typeof operation.operationId === 'string' || operation.operationId === undefined).toBe(
            true,
          );
          expect(context.length).toBeGreaterThan(0);
        }
      }
    });

    it('every operation documents error scenarios', () => {
      for (const [routePath, operations] of Object.entries(doc.paths)) {
        for (const [method, operation] of Object.entries(operations)) {
          if (!(HTTP_METHODS as readonly string[]).includes(method.toLowerCase())) {
            continue;
          }
          const statusCodes = Object.keys(operation.responses ?? {});
          const hasErrorResponse = statusCodes.some((code) => {
            const numeric = parseInt(code, 10);
            return !Number.isNaN(numeric) && numeric >= 400;
          });
          expect(hasErrorResponse).toBe(true);
        }
      }
    });

    it('every operation includes at least one example', () => {
      for (const [routePath, operations] of Object.entries(doc.paths)) {
        for (const [method, operation] of Object.entries(operations)) {
          if (!(HTTP_METHODS as readonly string[]).includes(method.toLowerCase())) {
            continue;
          }
          const examples: unknown[] = [];

          // Request body examples.
          const requestContent = operation.requestBody?.content ?? {};
          for (const media of Object.values(requestContent)) {
            if (media.example !== undefined) {
              examples.push(media.example);
            }
            if (media.examples && Object.keys(media.examples).length > 0) {
              examples.push(media.examples);
            }
          }

          // Parameter examples.
          for (const param of operation.parameters ?? []) {
            if (param.example !== undefined) {
              examples.push(param.example);
            }
            if (param.examples && Object.keys(param.examples).length > 0) {
              examples.push(param.examples);
            }
          }

          // Response examples.
          for (const response of Object.values(operation.responses ?? {})) {
            const content = (response as { content?: Record<string, { example?: unknown; examples?: Record<string, unknown> }> })
              .content;
            for (const media of Object.values(content ?? {})) {
              if (media.example !== undefined) {
                examples.push(media.example);
              }
              if (media.examples && Object.keys(media.examples).length > 0) {
                examples.push(media.examples);
              }
            }
          }

          expect(examples.length).toBeGreaterThan(0);
        }
      }
    });
  });

  describe('drift detection', () => {
    it('documented paths/methods match actual route handlers', () => {
      const sourceFiles = collectSourceFiles(SRC_DIR);
      const actualRoutes = discoverRoutes(sourceFiles);
      const documented = documentedRoutes(doc);

      const documentedKeys = new Set(documented.map(routeKey));
      const actualKeys = new Set(actualRoutes.map(routeKey));

      const missingFromDocs = [...actualKeys].filter((key) => !documentedKeys.has(key)).sort();
      const missingFromCode = [...documentedKeys].filter((key) => !actualKeys.has(key)).sort();

      expect({ missingFromDocs, missingFromCode }).toEqual({
        missingFromDocs: [],
        missingFromCode: [],
      });
    });
  });
});