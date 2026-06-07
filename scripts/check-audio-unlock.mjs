#!/usr/bin/env node
/**
 * check-audio-unlock.mjs
 *
 * Verifica que ningún archivo .ts bajo src/app/** cree audio "crudo"
 * (`new Audio(...)`, `new AudioContext(...)` o `new webkitAudioContext(...)`)
 * fuera de la lista blanca de servicios de audio.
 *
 * Motivo: en iOS/WebKit la reproducción de audio queda bloqueada hasta un gesto
 * del usuario. Cada `new Audio()` suelto necesita su propio desbloqueo y, si se
 * dispara fuera de un gesto (evento WS, setTimeout, observable), no suena —el bug
 * clásico del SFX que no se escucha en la primera partida—. Para que esto no se
 * repita, todo SFX debe pasar por `AudioPlaybackService` (canal central con un
 * único AudioContext desbloqueado al bootstrap). Ver memoria audio-architecture.
 *
 * Archivos permitidos (gestionan el desbloqueo ellos mismos, a propósito):
 *   - core/services/audio-playback.service.ts   (el canal central)
 *   - core/services/ui-click-sound.service.ts   (Web Audio propio + fallback)
 *   - features/match/services/background-music.service.ts (loop con MediaElement)
 *
 * Uso:
 *   node scripts/check-audio-unlock.mjs             # revisión normal
 *   node scripts/check-audio-unlock.mjs --self-test # prueba interna con fixture
 *   node scripts/check-audio-unlock.mjs <archivo...> # revisa archivos puntuales (lint-staged)
 *
 * Salida:
 *   - Imprime  file:line:col — mensaje  por cada hallazgo.
 *   - Exita con código 1 si hay al menos un hallazgo; 0 en caso contrario.
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import { fileURLToPath } from 'url';

// ---------------------------------------------------------------------------
// Configuración
// ---------------------------------------------------------------------------

const ROOT = join(fileURLToPath(import.meta.url), '..', '..');

/** Directorio raíz de búsqueda (relativo a ROOT). */
const SEARCH_ROOT = 'src/app';

/** Archivos autorizados a crear audio crudo (rutas relativas a ROOT, con `/`). */
const ALLOWLIST = new Set([
  'src/app/core/services/audio-playback.service.ts',
  'src/app/core/services/ui-click-sound.service.ts',
  'src/app/features/match/services/background-music.service.ts',
]);

/** Patrón de creación de audio crudo. */
const RAW_AUDIO_RE = /\bnew\s+(?:Audio|AudioContext|webkitAudioContext)\s*\(/g;

const MESSAGE =
  'No crear audio crudo (new Audio/AudioContext). Reproducí SFX vía AudioPlaybackService.';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Elimina comentarios y literales de string preservando longitud (offsets estables). */
function stripNoise(content) {
  let out = content.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  out = out.replace(/\/\/[^\n]*/g, (m) => ' '.repeat(m.length));
  // Literales de string (', ", `) — evita falsos positivos en textos/ejemplos.
  out = out.replace(/(['"`])(?:\\.|(?!\1)[^\\])*\1/g, (m) => m.replace(/[^\n]/g, ' '));
  return out;
}

/** Convierte un offset de caracteres en { line, col } (1-based). */
function offsetToLineCol(content, offset) {
  const before = content.slice(0, offset);
  const line = (before.match(/\n/g) ?? []).length + 1;
  const lastNl = before.lastIndexOf('\n');
  const col = offset - lastNl;
  return { line, col };
}

// ---------------------------------------------------------------------------
// Motor de análisis
// ---------------------------------------------------------------------------

function analyzeContent(filePath, rawContent) {
  const rel = relative(ROOT, filePath).replace(/\\/g, '/');
  if (ALLOWLIST.has(rel)) {
    return [];
  }

  const content = stripNoise(rawContent);
  const findings = [];
  RAW_AUDIO_RE.lastIndex = 0;
  let match;
  while ((match = RAW_AUDIO_RE.exec(content)) !== null) {
    const { line, col } = offsetToLineCol(content, match.index);
    findings.push({ file: rel, line, col, message: MESSAGE });
  }
  return findings;
}

/** Recolecta todos los .ts (excepto specs) bajo un directorio, recursivo. */
function collectTs(dir) {
  const results = [];
  try {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        results.push(...collectTs(full));
      } else if (entry.endsWith('.ts') && !entry.endsWith('.spec.ts')) {
        results.push(full);
      }
    }
  } catch {
    // directorio inexistente — ignorar
  }
  return results;
}

function reportAndExit(findings, scanned) {
  for (const { file, line, col, message } of findings) {
    console.error(`${file}:${line}:${col} — ${message}`);
  }
  if (findings.length > 0) {
    console.error(
      `\n✖ check-audio-unlock: ${findings.length} creación(es) de audio crudo. Usar AudioPlaybackService.`,
    );
    process.exit(1);
  }
  console.log(`✔ check-audio-unlock: sin violaciones (${scanned} archivo(s)).`);
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Self-test
// ---------------------------------------------------------------------------

function runSelfTest() {
  const DIRTY = `
const a = new Audio('/x.mp3');
const ctx = new AudioContext();
`.trim();

  const CLEAN = `
this.playback.play('/x.mp3');
// el comentario new Audio() no cuenta
const label = 'new Audio() en un string tampoco';
`.trim();

  const dirty = analyzeContent(join(ROOT, 'src/app/features/x/dirty.ts'), DIRTY);
  const clean = analyzeContent(join(ROOT, 'src/app/features/x/clean.ts'), CLEAN);
  const allowed = analyzeContent(
    join(ROOT, 'src/app/core/services/audio-playback.service.ts'),
    DIRTY,
  );

  let passed = true;
  if (dirty.length !== 2) {
    console.error(`[self-test] FAIL: esperadas 2 violaciones, encontradas ${dirty.length}`);
    passed = false;
  } else {
    console.log('[self-test] PASS: 2 violaciones detectadas en fixture sucio.');
  }
  if (clean.length !== 0) {
    console.error(`[self-test] FAIL: fixture limpio generó ${clean.length} falsos positivos.`);
    passed = false;
  } else {
    console.log('[self-test] PASS: fixture limpio sin falsos positivos.');
  }
  if (allowed.length !== 0) {
    console.error(`[self-test] FAIL: archivo en allowlist marcó ${allowed.length} hallazgos.`);
    passed = false;
  } else {
    console.log('[self-test] PASS: allowlist exenta correctamente.');
  }
  return passed ? 0 : 1;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);

if (args.includes('--self-test')) {
  process.exit(runSelfTest());
}

const explicit = args.filter((a) => !a.startsWith('--'));
const files =
  explicit.length > 0
    ? explicit
        .map((f) => (f.startsWith('/') || /^[A-Za-z]:/.test(f) ? f : join(ROOT, f)))
        .filter((f) => f.endsWith('.ts') && !f.endsWith('.spec.ts'))
    : collectTs(join(ROOT, SEARCH_ROOT));

const findings = files.flatMap((f) => analyzeContent(f, readFileSync(f, 'utf8')));
reportAndExit(findings, files.length);
