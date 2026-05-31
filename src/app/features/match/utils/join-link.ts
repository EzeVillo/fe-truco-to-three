export function buildJoinUrl(joinCode: string): string {
  const trimmedCode = joinCode.trim();
  if (!trimmedCode) {
    return '';
  }

  const origin = globalThis.location?.origin ?? 'http://localhost:4200';
  return new URL(`/join/${encodeURIComponent(trimmedCode)}`, origin).toString();
}
