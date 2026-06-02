#!/usr/bin/env node
/**
 * check-hover-gating.mjs
 *
 * Verifica que todo selector con la pseudo-clase `:hover` en los SCSS bajo
 * src/app/{features,shared/components}/** esté anidado dentro de un bloque
 * `@media (hover: hover) { ... }`.
 *
 * Motivo: en pantallas táctiles el estado `:hover` queda "pegado" tras un tap
 * hasta que el usuario toca otro lado. Si el hover pinta el fondo, el control
 * queda visualmente "seleccionado" sin haberlo tocado. Gatear el hover detrás
 * de `@media (hover: hover)` lo restringe a punteros reales (mouse).
 *
 * No analiza `:active` ni `:focus-visible` (válidos en táctil / accesibilidad).
 *
 * Uso:
 *   node scripts/check-hover-gating.mjs             # revisión normal
 *   node scripts/check-hover-gating.mjs --self-test # prueba interna con fixture
 *   node scripts/check-hover-gating.mjs <archivo...> # revisa archivos puntuales (lint-staged)
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

/** Directorios raíz de búsqueda (relativos a ROOT). */
const SEARCH_ROOTS = ['src/app/features', 'src/app/shared/components'];

const MESSAGE =
  ':hover debe ir dentro de @media (hover: hover) para no quedar pegado en táctil.';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Elimina comentarios SCSS (`// línea` y `/* bloque *​/`) preservando longitud. */
function stripComments(content) {
  let out = content.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  out = out.replace(/\/\/[^\n]*/g, (m) => ' '.repeat(m.length));
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

/** ¿El prelude de un at-rule `@media ...` activa la condición `hover: hover`? */
function isHoverMediaPrelude(prelude) {
  if (!/^@media\b/.test(prelude)) return false;
  // Acepta `(hover: hover)` con cualquier espaciado; ignora `any-hover`.
  return /\(\s*hover\s*:\s*hover\s*\)/.test(prelude);
}

// ---------------------------------------------------------------------------
// Motor de análisis
// ---------------------------------------------------------------------------

/**
 * Recorre el SCSS carácter a carácter manteniendo una pila de "preludes"
 * (el texto que precede a cada `{`). Cuando un prelude de selector contiene
 * `:hover`, verifica que algún ancestro sea un `@media (hover: hover)`.
 */
function analyzeContent(filePath, rawContent) {
  const content = stripComments(rawContent);
  const findings = [];
  const rel = relative(ROOT, filePath).replace(/\\/g, '/');

  /** Pila de bloques abiertos: { isHoverMedia: boolean }. */
  const stack = [];
  let preludeStart = 0;
  let interpDepth = 0; // profundidad de interpolación `#{ ... }`

  for (let i = 0; i < content.length; i++) {
    const ch = content[i];

    // Interpolación SCSS: `#{ ... }` — sus llaves no abren bloques.
    if (ch === '#' && content[i + 1] === '{') {
      interpDepth++;
      i++;
      continue;
    }
    if (interpDepth > 0) {
      if (ch === '{') interpDepth++;
      else if (ch === '}') interpDepth--;
      continue;
    }

    if (ch === '{') {
      const prelude = content.slice(preludeStart, i).trim().replace(/\s+/g, ' ');
      const hoverMedia = isHoverMediaPrelude(prelude);
      const isAtRule = prelude.startsWith('@');

      if (!isAtRule && prelude.includes(':hover')) {
        const gated = stack.some((b) => b.isHoverMedia);
        if (!gated) {
          const rawOffset = rawContent.indexOf(':hover', preludeStart);
          const at = rawOffset >= 0 ? rawOffset : preludeStart;
          const { line, col } = offsetToLineCol(rawContent, at);
          findings.push({ file: rel, line, col, message: MESSAGE });
        }
      }

      stack.push({ isHoverMedia: hoverMedia });
      preludeStart = i + 1;
    } else if (ch === '}') {
      stack.pop();
      preludeStart = i + 1;
    } else if (ch === ';') {
      preludeStart = i + 1;
    }
  }

  return findings;
}

/** Recolecta todos los .scss bajo un directorio de forma recursiva. */
function collectScss(dir) {
  const results = [];
  try {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) results.push(...collectScss(full));
      else if (entry.endsWith('.scss')) results.push(full);
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
      `\n✖ check-hover-gating: ${findings.length} :hover sin gatear. Envolver en @media (hover: hover).`,
    );
    process.exit(1);
  }
  console.log(`✔ check-hover-gating: sin violaciones (${scanned} archivo(s)).`);
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Self-test
// ---------------------------------------------------------------------------

function runSelfTest() {
  const DIRTY = `
.btn {
  &:hover { background: red; }
}
.tab:not(.tab--active):hover { color: blue; }
`.trim();

  const CLEAN = `
.btn {
  @media (hover: hover) {
    &:hover { background: red; }
  }
}
@media (hover: hover) {
  .tab:hover { color: blue; }
}
.btn:active { transform: none; }
.btn:focus-visible { outline: 1px; }
// el comentario :hover no cuenta
`.trim();

  const dirty = analyzeContent('/virtual/dirty.scss', DIRTY);
  const clean = analyzeContent('/virtual/clean.scss', CLEAN);

  let passed = true;
  if (dirty.length !== 2) {
    console.error(`[self-test] FAIL: esperadas 2 violaciones, encontradas ${dirty.length}`);
    for (const f of dirty) console.error(`  → ${f.line}:${f.col} ${f.message}`);
    passed = false;
  } else {
    console.log('[self-test] PASS: 2 violaciones detectadas en fixture sucio.');
  }
  if (clean.length !== 0) {
    console.error(`[self-test] FAIL: fixture limpio generó ${clean.length} falsos positivos.`);
    for (const f of clean) console.error(`  → ${f.line}:${f.col} ${f.message}`);
    passed = false;
  } else {
    console.log('[self-test] PASS: fixture limpio sin falsos positivos.');
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

// Archivos explícitos (lint-staged) o barrido completo.
const explicit = args.filter((a) => !a.startsWith('--'));
const files =
  explicit.length > 0
    ? explicit.map((f) => (f.startsWith('/') || /^[A-Za-z]:/.test(f) ? f : join(ROOT, f)))
    : SEARCH_ROOTS.flatMap((rel) => collectScss(join(ROOT, rel)));

const findings = files.flatMap((f) => analyzeContent(f, readFileSync(f, 'utf8')));
reportAndExit(findings, files.length);
