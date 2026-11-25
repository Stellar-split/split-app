'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

const SWAGGER_UI_VERSION = '5.17.14';
const SWAGGER_UI_CSS = `https://unpkg.com/swagger-ui-dist@${SWAGGER_UI_VERSION}/swagger-ui.css`;
const SWAGGER_UI_JS = `https://unpkg.com/swagger-ui-dist@${SWAGGER_UI_VERSION}/swagger-ui-bundle.js`;
const OPENAPI_SPEC_URL = '/openapi.json';

type SwaggerUIInstance = {
  destroy?: () => void;
};

type SwaggerUIGlobal = {
  (config: Record<string, unknown>): SwaggerUIInstance;
};

declare global {
  interface Window {
    SwaggerUIBundle?: SwaggerUIGlobal;
  }
}

/**
 * Loads an external script without injecting inline JavaScript, so the page
 * remains compatible with strict Content-Security-Policy rules (no
 * 'unsafe-inline' required for script-src).
 */
function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[data-swagger-src="${src}"]`,
    );
    if (existing) {
      if (existing.dataset.loaded === 'true') {
        resolve();
        return;
      }
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)), {
        once: true,
      });
      return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.dataset.swaggerSrc = src;
    script.addEventListener(
      'load',
      () => {
        script.dataset.loaded = 'true';
        resolve();
      },
      { once: true },
    );
    script.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)), {
      once: true,
    });
    document.body.appendChild(script);
  });
}

function loadStylesheet(href: string): void {
  if (document.querySelector(`link[data-swagger-href="${href}"]`)) {
    return;
  }
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  link.crossOrigin = 'anonymous';
  link.dataset.swaggerHref = href;
  document.head.appendChild(link);
}

export default function ApiDocsPage() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const uiRef = useRef<SwaggerUIInstance | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        loadStylesheet(SWAGGER_UI_CSS);
        await loadScript(SWAGGER_UI_JS);

        if (cancelled) {
          return;
        }

        const SwaggerUIBundle = window.SwaggerUIBundle;
        if (!SwaggerUIBundle) {
          throw new Error('Swagger UI bundle did not initialize.');
        }

        if (!containerRef.current) {
          return;
        }

        uiRef.current?.destroy?.();
        containerRef.current.innerHTML = '';

        uiRef.current = SwaggerUIBundle({
          url: OPENAPI_SPEC_URL,
          dom_id: '#swagger-ui-container',
          deepLinking: true,
          docExpansion: 'list',
          defaultModelsExpandDepth: 1,
          defaultModelExpandDepth: 1,
          displayRequestDuration: true,
          filter: true,
          persistAuthorization: true,
          tryItOutEnabled: true,
          validatorUrl: null,
          supportedSubmitMethods: ['get', 'post', 'put', 'patch', 'delete'],
          onComplete: () => {
            if (!cancelled) {
              setStatus('ready');
            }
          },
          onFailure: (err: unknown) => {
            if (!cancelled) {
              setStatus('error');
              setErrorMessage(
                err instanceof Error ? err.message : 'Failed to load the OpenAPI specification.',
              );
            }
          },
        });

        if (!cancelled) {
          setStatus('ready');
        }
      } catch (err) {
        if (!cancelled) {
          setStatus('error');
          setErrorMessage(err instanceof Error ? err.message : 'Failed to load API docs.');
        }
      }
    }

    void init();

    return () => {
      cancelled = true;
      uiRef.current?.destroy?.();
      uiRef.current = null;
    };
  }, []);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">API Documentation</h1>
          <p className="mt-1 text-sm text-gray-600">
            Interactive OpenAPI reference generated from{' '}
            <code className="rounded bg-gray-100 px-1 py-0.5 text-xs">{OPENAPI_SPEC_URL}</code>.
          </p>
        </div>
        <nav className="flex flex-wrap gap-3 text-sm">
          <Link className="text-blue-600 underline hover:text-blue-800" href="/developers">
            Developer Docs
          </Link>
          <a
            className="text-blue-600 underline hover:text-blue-800"
            href={OPENAPI_SPEC_URL}
            target="_blank"
            rel="noreferrer"
          >
            Raw OpenAPI JSON
          </a>
        </nav>
      </header>

      {status === 'loading' && (
        <div role="status" className="mb-4 rounded border border-gray-200 bg-gray-50 p-4 text-sm">
          Loading interactive API documentation…
        </div>
      )}

      {status === 'error' && (
        <div role="alert" className="mb-4 rounded border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <p className="font-semibold">Unable to load the interactive API documentation.</p>
          {errorMessage && <p className="mt-1">{errorMessage}</p>}
          <p className="mt-2">
            You can still view the raw specification at{' '}
            <a className="underline" href={OPENAPI_SPEC_URL} target="_blank" rel="noreferrer">
              {OPENAPI_SPEC_URL}
            </a>
            .
          </p>
        </div>
      )}

      <div id="swagger-ui-container" ref={containerRef} className="swagger-ui-wrapper" />
    </main>
  );
}