/**
 * HTML sanitization for email content
 * Ensures Gmail-safe HTML structure
 */

import DOMPurify from "isomorphic-dompurify";

/**
 * Configuration for email-safe HTML sanitization
 * Gmail prefers minimal HTML with table-based layouts
 */
const EMAIL_HTML_CONFIG = {
  ALLOWED_TAGS: [
    "p",
    "br",
    "strong",
    "em",
    "u",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "ul",
    "ol",
    "li",
    "a",
    "table",
    "thead",
    "tbody",
    "tr",
    "td",
    "th",
    "div",
    "span",
    "hr",
    "blockquote",
  ],
  ALLOWED_ATTR: [
    "href",
    "title",
    "alt",
    "align",
    "valign",
    "colspan",
    "rowspan",
    "width",
    "height",
    "style",
    "class",
  ],
  ALLOW_DATA_ATTR: false,
  KEEP_CONTENT: true,
};

/**
 * Sanitizes HTML content for email
 */
export function sanitizeHtml(html: string): string {
  if (!html || typeof html !== "string") {
    return "";
  }

  // Configure DOMPurify for email-safe HTML
  const clean = DOMPurify.sanitize(html, {
    ...EMAIL_HTML_CONFIG,
    // Remove script tags and event handlers
    FORBID_TAGS: ["script", "iframe", "object", "embed", "form", "input"],
    FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover"],
  });

  return clean;
}

/**
 * Extracts plain text from HTML
 * Used to generate text/plain version for multipart/alternative
 */
export function htmlToPlainText(html: string): string {
  if (!html || typeof html !== "string") {
    return "";
  }

  // Remove HTML tags
  let text = html.replace(/<[^>]+>/g, " ");

  // Decode HTML entities
  text = text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  // Normalize whitespace
  text = text.replace(/\s+/g, " ").trim();

  // Restore line breaks for common block elements
  text = text.replace(/(<\/p>|<\/div>|<\/h[1-6]>|<\/li>|<\/tr>)/gi, "\n");
  text = text.replace(/(<br\s*\/?>)/gi, "\n");

  // Clean up
  text = text.replace(/\n\s*\n\s*\n/g, "\n\n"); // Max 2 consecutive newlines
  text = text.trim();

  return text;
}

/**
 * Validates HTML structure for email compatibility
 */
export function validateEmailHtmlStructure(html: string): {
  valid: boolean;
  warnings: string[];
} {
  const warnings: string[] = [];

  if (!html || typeof html !== "string") {
    return { valid: false, warnings: ["HTML is empty"] };
  }

  // Check for common email compatibility issues
  if (html.includes("<script")) {
    warnings.push("Script tags found (will be removed)");
  }

  if (html.includes("javascript:")) {
    warnings.push("JavaScript URLs found (will be removed)");
  }

  if (html.includes("onclick=") || html.includes("onerror=")) {
    warnings.push("Event handlers found (will be removed)");
  }

  // Check for proper structure (optional)
  if (!html.includes("<body") && !html.includes("<p") && !html.includes("<div")) {
    warnings.push("HTML may lack proper structure");
  }

  // Check for excessive nesting (Gmail doesn't like deep nesting)
  const maxDepth = (html.match(/<[^>]+>/g) || []).length;
  if (maxDepth > 50) {
    warnings.push("HTML has excessive nesting (may cause rendering issues)");
  }

  return {
    valid: warnings.length === 0,
    warnings,
  };
}

/**
 * Creates a simple multipart/alternative structure
 * Returns both HTML and plain text versions
 */
export function createMultipartEmail(
  htmlContent: string,
  plainTextContent?: string
): {
  html: string;
  text: string;
} {
  const sanitizedHtml = sanitizeHtml(htmlContent);
  const text =
    plainTextContent || htmlToPlainText(sanitizedHtml || htmlContent);

  return {
    html: sanitizedHtml,
    text: text,
  };
}
