#!/usr/bin/env node
/**
 * check-themed-templates.mjs
 *
 * Verifica que los templates HTML bajo src/app/{features,shared/components}/**
 * no usen directivas Material con paleta stock ni atributos `color="primary|accent|warn"`.
 *
 * Patrones prohibidos (fuera de comentarios HTML):
 *   - color="primary" | color='primary'
 *   - color="accent"  | color='accent'
 *   - color="warn"    | color='warn'
 *   - mat-flat-button
 *   - mat-raised-button
 *   - mat-fab
 *   - mat-mini-fab
 *
 * Uso:
 *   node scripts/check-themed-templates.mjs             # revisión normal
 *   node scripts/check-themed-templates.mjs --self-test # prueba interna con fixture
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
const SEARCH_ROOTS = [
  'src/app/features',
  'src/app/shared/components',
];

/** Prefijos de archivo (relativos a ROOT) que están en lista blanca. */
const WHITELIST_PREFIXES = [
  'src/app/shared/components/confirm-dialog',
];

/** Reglas: cada entrada es { pattern: RegExp, message: string } */
const RULES = [
  {
    pattern: /\bcolor=['"]primary['"]/g,
    message: 'Material primary palette en templates de feature/shared: usar variantes tematizadas (t3-btn--primary).',
  },
  {
    pattern: /\bcolor=['"]accent['"]/g,
    message: 'Material accent palette en templates de feature/shared: usar variantes tematizadas.',
  },
  {
    pattern: /\bcolor=['"]warn['"]/g,
    message: 'Material warn palette en templates de feature/shared: usar variantes tematizadas (t3-btn--destructive).',
  },
  {
    pattern: /\bmat-flat-button\b/g,
    message: 'mat-flat-button prohibido en superficies del producto: usar t3-btn.',
  },
  {
    pattern: /\bmat-raised-button\b/g,
    message: 'mat-raised-button prohibido en superficies del producto: usar t3-btn.',
  },
  {
    pattern: /\bmat-fab\b/g,
    message: 'mat-fab prohibido en superficies del producto: usar t3-btn.',
  },
  {
    pattern: /\bmat-mini-fab\b/g,
    message: 'mat-mini-fab prohibido en superficies del producto: usar t3-btn.',
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Elimina comentarios HTML <!-- ... --> del contenido antes de analizar. */
function stripHtmlComments(content) {
  return content.replace(/<!--[\s\S]*?-->/g, (match) => ' '.repeat(match.length));
}

/** Convierte un offset de caracteres en { line, col } (1-based). */
function offsetToLineCol(content, offset) {
  const before = content.slice(0, offset);
  const line = (before.match(/\n/g) ?? []).length + 1;
  const lastNl = before.lastIndexOf('\n');
  const col = offset - lastNl;
  return { line, col };
}

/** Recolecta todos los archivos .html bajo un directorio de forma recursiva. */
function collectHtml(dir) {
  const results = [];
  try {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      const stat = statSync(full);
      if (stat.isDirectory()) {
        results.push(...collectHtml(full));
      } else if (entry.endsWith('.html')) {
        results.push(full);
      }
    }
  } catch {
    // directorio no existente — ignorar silenciosamente
  }
  return results;
}

/** Retorna true si el archivo está en la whitelist. */
function isWhitelisted(filePath) {
  const rel = relative(ROOT, filePath).replace(/\\/g, '/');
  return WHITELIST_PREFIXES.some((prefix) => rel.startsWith(prefix));
}

// ---------------------------------------------------------------------------
// Motor de análisis
// ---------------------------------------------------------------------------

function analyzeContent(filePath, rawContent) {
  if (isWhitelisted(filePath)) {
    return [];
  }

  const stripped = stripHtmlComments(rawContent);
  const findings = [];

  for (const rule of RULES) {
    rule.pattern.lastIndex = 0;
    let match;
    while ((match = rule.pattern.exec(stripped)) !== null) {
      const { line, col } = offsetToLineCol(rawContent, match.index);
      const rel = relative(ROOT, filePath).replace(/\\/g, '/');
      findings.push({ file: rel, line, col, message: rule.message });
    }
  }

  return findings;
}

function runOnFiles() {
  const files = SEARCH_ROOTS.flatMap((rel) => collectHtml(join(ROOT, rel)));
  const allFindings = files.flatMap((f) => analyzeContent(f, readFileSync(f, 'utf8')));

  for (const { file, line, col, message } of allFindings) {
    console.error(`${file}:${line}:${col} — ${message}`);
  }

  return allFindings.length;
}

// ---------------------------------------------------------------------------
// Self-test
// ---------------------------------------------------------------------------

function runSelfTest() {
  const FIXTURE_VIOLATIONS = `
<button mat-flat-button color="primary">Guardar</button>
<button mat-raised-button color="accent">Editar</button>
<button mat-fab color="warn">X</button>
<!-- mat-flat-button aquí no debería detectarse: -->
<!-- <button mat-flat-button>ok</button> -->
<button mat-mini-fab>+</button>
  `.trim();

  const FIXTURE_CLEAN = `
<button type="button" class="t3-btn t3-btn--primary">Guardar</button>
<button type="button" class="t3-btn t3-btn--neutral">Cancelar</button>
  `.trim();

  const findings = analyzeContent('/virtual/test.html', FIXTURE_VIOLATIONS);
  const cleanFindings = analyzeContent('/virtual/clean.html', FIXTURE_CLEAN);

  // mat-flat-button, color="primary", mat-raised-button, color="accent", mat-fab, color="warn", mat-mini-fab
  // El comentario HTML no debe contar como violación
  const expectedViolations = 7; // mat-flat-button + color="primary" + mat-raised-button + color="accent" + mat-fab + color="warn" + mat-mini-fab
  let passed = true;

  if (findings.length !== expectedViolations) {
    console.error(`[self-test] FAIL: esperadas ${expectedViolations} violaciones, encontradas ${findings.length}`);
    for (const f of findings) console.error(`  → ${f.line}:${f.col} ${f.message}`);
    passed = false;
  } else {
    console.log(`[self-test] PASS: ${findings.length} violaciones detectadas correctamente en fixture con violaciones.`);
  }

  if (cleanFindings.length !== 0) {
    console.error(`[self-test] FAIL: fixture limpio generó ${cleanFindings.length} falsos positivos.`);
    passed = false;
  } else {
    console.log('[self-test] PASS: fixture limpio no genera falsos positivos.');
  }

  return passed ? 0 : 1;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

const isSelfTest = process.argv.includes('--self-test');

if (isSelfTest) {
  process.exit(runSelfTest());
} else {
  const count = runOnFiles();
  if (count > 0) {
    console.error(`\n✖ check-themed-templates: ${count} violación(es) encontrada(s). Reemplazar con variantes t3-btn.`);
    process.exit(1);
  } else {
    console.log('✔ check-themed-templates: sin violaciones.');
    process.exit(0);
  }
}
