/**
 * The one thing this scaffold does, so the whole chain — the component,
 * its test, hooks, CI — has something real to run against. Replace it
 * with your first real page content and delete this file.
 */
export function getGreeting(name?: string): string {
  const trimmed = name?.trim();
  return trimmed ? `Hello, ${trimmed}!` : "Hello, world!";
}
