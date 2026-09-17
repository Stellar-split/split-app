import {
  sanitizeHtml,
  createSafeHtmlProps,
  DEFAULT_ALLOWED_TAGS,
  BLOCKED_TAGS,
  SanitizerConfigurationError,
} from '@/lib/htmlSanitizer';

describe('htmlSanitizer', () => {
  it('returns empty string for empty or non-string input', () => {
    expect(sanitizeHtml('')).toBe('');
    expect(sanitizeHtml(null as unknown as string)).toBe('');
    expect(sanitizeHtml(undefined as unknown as string)).toBe('');
  });

  it('allows default tags by default', () => {
    const html = '<p>Hello <strong>world</strong>! <a href="https://example.com" title="test">link</a></p>';
    expect(sanitizeHtml(html)).toBe(html);
  });

  it('strips non-default tags when no allowedTags is provided', () => {
    const html = '<p>Normal</p><mark>Highlight</mark><kbd>Ctrl</kbd>';
    expect(sanitizeHtml(html)).toBe('<p>Normal</p>HighlightCtrl');
  });

  it('merges custom allowedTags with default allowlist rather than replacing it', () => {
    const html = '<p>Intro</p><mark>Custom tag</mark><kbd>Ctrl+C</kbd><abbr title="World Wide Web">WWW</abbr>';
    const sanitized = sanitizeHtml(html, {
      allowedTags: ['mark', 'kbd', 'abbr'],
    });

    expect(sanitized).toContain('<p>Intro</p>');
    expect(sanitized).toContain('<mark>Custom tag</mark>');
    expect(sanitized).toContain('<kbd>Ctrl+C</kbd>');
    expect(sanitized).toContain('<abbr title="World Wide Web">WWW</abbr>');
  });

  it('sanitises dangerous attributes on custom allowed tags', () => {
    const html = '<mark onclick="alert(1)" onmouseover="evil()" title="safe">Safe Mark</mark>';
    const sanitized = sanitizeHtml(html, {
      allowedTags: ['mark'],
    });

    expect(sanitized).toContain('<mark title="safe">Safe Mark</mark>');
    expect(sanitized).not.toContain('onclick');
    expect(sanitized).not.toContain('onmouseover');
  });

  it('strips javascript: URLs even when href is allowed', () => {
    const html = '<a href="javascript:alert(1)">Click</a>';
    const sanitized = sanitizeHtml(html);
    expect(sanitized).not.toContain('javascript:');
  });

  it('throws SanitizerConfigurationError when a blocked tag is in allowedTags', () => {
    expect(() => {
      sanitizeHtml('<p>test</p>', { allowedTags: ['script'] });
    }).toThrow(SanitizerConfigurationError);

    expect(() => {
      sanitizeHtml('<p>test</p>', { allowedTags: ['iframe'] });
    }).toThrow(SanitizerConfigurationError);

    expect(() => {
      sanitizeHtml('<p>test</p>', { allowedTags: ['OBJECT'] });
    }).toThrow(SanitizerConfigurationError);

    expect(() => {
      sanitizeHtml('<p>test</p>', { allowedTags: ['form'] });
    }).toThrow(SanitizerConfigurationError);
  });

  it('createSafeHtmlProps returns dangerouslySetInnerHTML object with sanitized HTML', () => {
    const props = createSafeHtmlProps('<strong>Bold</strong><mark>Marked</mark>', {
      allowedTags: ['mark'],
    });
    expect(props).toEqual({
      dangerouslySetInnerHTML: {
        __html: '<strong>Bold</strong><mark>Marked</mark>',
      },
    });
  });
});
