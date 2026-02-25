/**
 * Strip HTML tags from a string to prevent XSS in stored content.
 */
export function stripHtml(input: string): string {
  return input.replace(/<[^>]*>/g, "").trim();
}
