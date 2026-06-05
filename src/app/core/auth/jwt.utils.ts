/**
 * Decodifica el claim `exp` de un JWT y lo devuelve en epochMs.
 *
 * Defensivo: ante cualquier token que no sea un JWT bien formado con `exp`
 * numérico, devuelve null. El caller debe tratar null como "expiración
 * desconocida" y delegar en el refresh reactivo.
 */
export function readJwtExpiry(token: string): number | null {
  const parts = token.split('.');
  if (parts.length !== 3) {
    return null;
  }

  try {
    const payload = decodeBase64Url(parts[1]);
    const parsed = JSON.parse(payload) as { exp?: unknown };
    if (typeof parsed.exp !== 'number') {
      return null;
    }
    return parsed.exp * 1000;
  } catch {
    return null;
  }
}

function decodeBase64Url(value: string): string {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padding = (4 - (base64.length % 4)) % 4;
  const padded = base64.padEnd(base64.length + padding, '=');
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
