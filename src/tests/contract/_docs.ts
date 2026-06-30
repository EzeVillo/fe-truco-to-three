import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const CONTRATOS_DIR = resolve(process.cwd(), 'docs/contratos');

const FILES = [
  '00-convenciones.md',
  '01-auth.md',
  '02-matches.md',
  '03-leagues.md',
  '04-copas.md',
  '05-chat.md',
  '06-social.md',
  '07-perfil-presencia.md',
  '08-bots.md',
  '09-websocket.md',
  '10-flujos-fe.md',
] as const;

export type ContratoFile = (typeof FILES)[number];

export function readContrato(file: ContratoFile): string {
  return readFileSync(resolve(CONTRATOS_DIR, file), 'utf-8');
}

/** Concatena todos los docs/contratos/*.md, en el mismo orden que el índice. */
export function readFullContract(): string {
  return FILES.map(readContrato).join('\n\n');
}
