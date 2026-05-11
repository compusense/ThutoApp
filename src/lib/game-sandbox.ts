
/**
 * Helper functions for the Game Sandbox feature.
 */

/**
 * Generates a unique storage path for a game upload.
 */
export function generateGamePath(developerId: string, timestamp: number): string {
  return `games/${developerId}_${timestamp}/`;
}

/**
 * Normalizes a subject name for consistent indexing.
 */
export function normalizeSubject(subject: string): string {
  return subject.trim().toLowerCase();
}

/**
 * Validates a game manifest object.
 */
export function validateManifest(manifest: any): boolean {
  return (
    typeof manifest === 'object' &&
    typeof manifest.title === 'string' &&
    typeof manifest.version === 'string' &&
    typeof manifest.subject === 'string' &&
    typeof manifest.gradeLevel === 'string'
  );
}

/**
 * Safely wraps a game URL for use in a sandboxed iframe.
 */
export function getSandboxedUrl(url: string): string {
  // Add any specific sandbox query parameters if needed by the game engine
  return url;
}
