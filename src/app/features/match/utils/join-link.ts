export function buildJoinUrl(joinCode: string): string {
  const trimmedCode = joinCode.trim();
  if (!trimmedCode) {
    return '';
  }

  const baseUrl = globalThis.document?.baseURI ?? 'http://localhost:4200/';
  return new URL(`join/${encodeURIComponent(trimmedCode)}`, baseUrl).toString();
}
