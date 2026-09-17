import DOMPurify from 'dompurify';

export const DEFAULT_ALLOWED_TAGS = [
  'p',
  'br',
  'strong',
  'em',
  'u',
  'ul',
  'ol',
  'li',
  'a',
  'h1',
  'h2',
  'h3',
];

export const ALLOWED_ATTR = ['href', 'title'];

export const BLOCKED_TAGS = new Set([
  'script',
  'iframe',
  'object',
  'embed',
  'base',
  'form',
  'input',
  'textarea',
  'button',
  'link',
  'meta',
  'style',
  'frame',
  'frameset',
  'applet',
]);

export class SanitizerConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SanitizerConfigurationError';
  }
}

export interface SanitizeOptions {
  allowedTags?: string[];
}

export function sanitizeHtml(dirty: string, options?: SanitizeOptions): string {
  if (!dirty || typeof dirty !== 'string') {
    return '';
  }

  let allowedTags = DEFAULT_ALLOWED_TAGS;

  if (options?.allowedTags) {
    for (const rawTag of options.allowedTags) {
      const tag = rawTag.toLowerCase().trim();
      if (BLOCKED_TAGS.has(tag)) {
        throw new SanitizerConfigurationError(
          `Tag "${rawTag}" is in the dangerous blocklist and cannot be configured in allowedTags`
        );
      }
    }

    const custom = options.allowedTags.map((t) => t.toLowerCase().trim());
    allowedTags = Array.from(new Set([...DEFAULT_ALLOWED_TAGS, ...custom]));
  }

  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: allowedTags,
    ALLOWED_ATTR,
  });
}

export function createSafeHtmlProps(html: string, options?: SanitizeOptions) {
  return {
    dangerouslySetInnerHTML: {
      __html: sanitizeHtml(html, options),
    },
  };
}
