#!/usr/bin/env node
/**
 * Token Compliance Audit
 * ──────────────────────
 * Scans CSS files for hardcoded values that should use design tokens,
 * and finds tokens defined in tokens.css but never referenced anywhere.
 *
 * Usage:  node .skills/skills/token-audit/scripts/audit-compliance.mjs [--json] [--fix-hints]
 *
 * Flags:
 *   --json        Output results as JSON (for programmatic use)
 *   --fix-hints   Include suggested var() replacements in output
 *   --file <path> Audit a single CSS file instead of all
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { resolve, dirname, relative, extname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../../../..');

// ── CLI flags ─────────────────────────────────────────
const args = process.argv.slice(2);
const JSON_OUTPUT = args.includes('--json');
const FIX_HINTS = args.includes('--fix-hints');
const SINGLE_FILE = args.includes('--file') ? args[args.indexOf('--file') + 1] : null;

// ── Colors (skipped in JSON mode) ─────────────────────
const c = JSON_OUTPUT ? { R: '', G: '', Y: '', C: '', D: '', B: '', X: '' } : {
  R: '\x1b[31m', G: '\x1b[32m', Y: '\x1b[33m',
  C: '\x1b[36m', D: '\x1b[2m', B: '\x1b[1m', X: '\x1b[0m',
};

// ── 1. Parse tokens.css into lookups ──────────────────

function parseTokens(filePath) {
  const src = readFileSync(filePath, 'utf-8');
  const tokens = new Map(); // name → { value, section }
  let section = 'root';

  for (const line of src.split('\n')) {
    const secMatch = line.match(/\/\*\s*─+\s*(.+?)\s*─+\s*\*\//);
    if (secMatch) { section = secMatch[1].trim(); continue; }

    // Stop at light theme — only index :root
    if (/html\[data-theme.*light|html\.light/.test(line)) break;

    const propMatch = line.match(/^\s*(--.+?):\s*(.+?)\s*;\s*(?:\/\*.*\*\/\s*)?$/);
    if (propMatch) {
      tokens.set(propMatch[1], { value: propMatch[2].trim(), section });
    }
  }
  return tokens;
}

// Build reverse index: normalized raw value → token names
function buildValueIndex(tokens) {
  const index = new Map();
  for (const [name, { value }] of tokens) {
    const norm = value.toLowerCase().replace(/\s+/g, ' ').trim();
    if (!index.has(norm)) index.set(norm, []);
    index.get(norm).push(name);
  }
  return index;
}

// ── 2. Build sets of known token values by type ───────

function buildTokenSets(tokens) {
  const colors = new Map();      // lowercase hex → token name
  const spacing = new Map();     // "Npx" → token name
  const radii = new Map();       // "Npx" → token name
  const fontSizes = new Map();   // "Npx" → token name
  const fontFamilies = new Map();// normalized family → token name
  const shadows = new Map();     // normalized shadow → token name
  const durations = new Map();   // e.g. "200ms" → token name

  for (const [name, { value }] of tokens) {
    const v = value.toLowerCase().trim();

    // Hex colors
    if (/^#[0-9a-f]{3,8}$/.test(v)) {
      colors.set(v, name);
      // Also store 6-digit expanded form for 3-digit hex
      if (v.length === 4) {
        colors.set(`#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`, name);
      }
    }

    // Spacing tokens (--gutter*)
    if (name.startsWith('--gutter')) {
      spacing.set(v, name);
    }

    // Radius tokens
    if (name.startsWith('--radius')) {
      radii.set(v, name);
    }

    // Font size tokens
    if (name.startsWith('--text-') && v.endsWith('px')) {
      fontSizes.set(v, name);
    }

    // Font family tokens
    if (name.startsWith('--font-') && (v.includes('sans') || v.includes('mono'))) {
      // Store the first family name for matching
      const family = v.split(',')[0].replace(/['"]/g, '').trim().toLowerCase();
      fontFamilies.set(family, name);
    }

    // Shadow tokens
    if (name.startsWith('--shadow-')) {
      shadows.set(v.replace(/\s+/g, ' '), name);
    }

    // Duration tokens
    if (name.startsWith('--dur-')) {
      durations.set(v, name);
    }
  }

  return { colors, spacing, radii, fontSizes, fontFamilies, shadows, durations };
}

// ── 3. Scan a single CSS file ─────────────────────────

function scanFile(filePath, tokenSets, valueIndex) {
  const src = readFileSync(filePath, 'utf-8');
  const lines = src.split('\n');
  const violations = [];
  const relPath = relative(ROOT, filePath);

  // Skip tokens.css itself
  if (relPath.endsWith('tokens.css')) return violations;

  let inBlockComment = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // Track block comments
    if (inBlockComment) {
      if (line.includes('*/')) inBlockComment = false;
      continue;
    }
    if (/^\s*\/\*/.test(line) && !line.includes('*/')) {
      inBlockComment = true;
      continue;
    }
    // Single-line comments
    if (/^\s*\/\*.*\*\/\s*$/.test(line)) continue;
    if (/^\s*\*/.test(line)) continue;

    // Skip custom property definitions — those ARE tokens
    if (/^\s*--[\w-]+\s*:/.test(line)) continue;

    // Skip lines that are pure var() usage (no hardcoded values to find)
    // But still check lines that MIX var() with hardcoded values

    // ── Check: Hex colors ──
    const hexRE = /(?<![;\w-])#([0-9a-fA-F]{3,8})(?![0-9a-fA-F\w-])/g;
    let m;
    while ((m = hexRE.exec(line)) !== null) {
      const hex = m[0].toLowerCase();
      // Skip if inside a url(), data:, or SVG fill/stroke context
      const before = line.slice(0, m.index);
      if (/url\([^)]*$/.test(before) || /data:/.test(before)) continue;
      // Skip if inside a var() already
      if (/var\([^)]*$/.test(before)) continue;

      const tokenName = tokenSets.colors.get(hex);
      if (tokenName) {
        violations.push({
          file: relPath, line: lineNum, category: 'color',
          raw: hex, suggestion: tokenName,
          lineContent: line.trim(),
        });
      }
    }

    // ── Check: Font sizes ──
    const fzMatch = line.match(/font-size:\s*(\d+(?:\.\d+)?px)/);
    if (fzMatch && !/var\(/.test(line.slice(0, line.indexOf(fzMatch[1])))) {
      const val = fzMatch[1].toLowerCase();
      const tokenName = tokenSets.fontSizes.get(val);
      if (tokenName) {
        violations.push({
          file: relPath, line: lineNum, category: 'font-size',
          raw: val, suggestion: tokenName,
          lineContent: line.trim(),
        });
      }
    }

    // ── Check: Border radius ──
    const brMatch = line.match(/border-radius:\s*(\d+(?:\.\d+)?px)/);
    if (brMatch) {
      const val = brMatch[1].toLowerCase();
      const tokenName = tokenSets.radii.get(val);
      if (tokenName) {
        violations.push({
          file: relPath, line: lineNum, category: 'border-radius',
          raw: val, suggestion: tokenName,
          lineContent: line.trim(),
        });
      }
    }

    // ── Check: Spacing (margin, padding, gap) ──
    // Only flag values that exactly match a spacing token
    const spacingRE = /(?:margin|padding|gap)(?:[-\w]*):\s*([^;]+)/;
    const spMatch = line.match(spacingRE);
    if (spMatch && !/var\(/.test(spMatch[1])) {
      // Extract individual px values from the shorthand
      const pxValues = spMatch[1].match(/(\d+(?:\.\d+)?px)/g);
      if (pxValues) {
        for (const val of pxValues) {
          const tokenName = tokenSets.spacing.get(val.toLowerCase());
          if (tokenName) {
            violations.push({
              file: relPath, line: lineNum, category: 'spacing',
              raw: val, suggestion: tokenName,
              lineContent: line.trim(),
            });
            break; // one violation per line for spacing
          }
        }
      }
    }

    // ── Check: Font families ──
    const ffMatch = line.match(/font-family:\s*([^;]+)/);
    if (ffMatch && !/var\(/.test(ffMatch[1])) {
      const rawFamilies = ffMatch[1].trim();
      // Skip generic keywords and inherit
      if (!/^(inherit|initial|unset|revert|sans-serif|serif|monospace|cursive|fantasy|system-ui)$/i.test(rawFamilies)) {
        const firstFamily = rawFamilies.split(',')[0].replace(/['"]/g, '').trim().toLowerCase();
        const tokenName = tokenSets.fontFamilies.get(firstFamily);
        if (tokenName) {
          violations.push({
            file: relPath, line: lineNum, category: 'font-family',
            raw: rawFamilies.split(',')[0].trim(), suggestion: tokenName,
            lineContent: line.trim(),
          });
        }
      }
    }

    // ── Check: Transition/animation durations ──
    const durRE = /(?:transition|animation)[^:]*:[^;]*?(?<!\d)(\d+(?:\.\d+)?m?s)(?![0-9a-zA-Z(])/g;
    while ((m = durRE.exec(line)) !== null) {
      let val = m[1].toLowerCase();
      // Normalize: 0.2s → 200ms for comparison
      if (val.endsWith('s') && !val.endsWith('ms')) {
        const ms = parseFloat(val) * 1000;
        val = `${ms}ms`;
      }
      if (val === '0ms' || val === '0s') continue;
      const tokenName = tokenSets.durations.get(val);
      if (tokenName) {
        violations.push({
          file: relPath, line: lineNum, category: 'duration',
          raw: m[1], suggestion: tokenName,
          lineContent: line.trim(),
        });
      }
    }
  }

  return violations;
}

// ── 4. Find unused tokens ─────────────────────────────

function findUnusedTokens(tokens, filePaths) {
  const allContent = filePaths.map(f => {
    try { return readFileSync(f, 'utf-8'); }
    catch { return ''; }
  }).join('\n');

  const unused = [];
  const systemTokens = new Set([
  ]);

  for (const [name, { value, section }] of tokens) {
    if (systemTokens.has(name)) continue;

    const varRef = `var(${name}`;
    const propRef = `'${name}'`;
    const propRef2 = `"${name}"`;
    // Also check for references in token definitions (tokens referencing other tokens)
    const tokenRef = `var(${name})`;

    // Remove the token's own definition line from consideration
    // by checking if it appears in files other than tokens.css
    const inOtherFiles = filePaths
      .filter(f => !f.endsWith('tokens.css'))
      .some(f => {
        try {
          const content = readFileSync(f, 'utf-8');
          return content.includes(varRef) || content.includes(propRef) || content.includes(propRef2);
        } catch { return false; }
      });

    // Also check if referenced within tokens.css itself by other tokens
    const tokensContent = readFileSync(resolve(ROOT, 'shared/tokens.css'), 'utf-8');
    const selfRefCount = (tokensContent.match(new RegExp(`var\\(${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\)`, 'g')) || []).length;

    if (!inOtherFiles && selfRefCount === 0) {
      unused.push({ name, value, section });
    }
  }

  return unused;
}

// ── 5. Collect files ──────────────────────────────────

function collectFiles(dir, extensions = ['.css', '.html', '.js']) {
  const results = [];
  const skipDirs = new Set(['node_modules', '.git', 'dist', '.skills', 'game-library-service']);

  function walk(d) {
    for (const entry of readdirSync(d)) {
      const full = resolve(d, entry);
      try {
        const stat = statSync(full);
        if (stat.isDirectory()) {
          if (!skipDirs.has(entry)) walk(full);
        } else if (extensions.includes(extname(entry))) {
          results.push(full);
        }
      } catch { /* skip inaccessible */ }
    }
  }

  walk(dir);
  return results;
}

// ── 6. Main ───────────────────────────────────────────

function main() {
  const tokensPath = resolve(ROOT, 'shared/tokens.css');
  const tokens = parseTokens(tokensPath);
  const valueIndex = buildValueIndex(tokens);
  const tokenSets = buildTokenSets(tokens);

  const cssFiles = SINGLE_FILE
    ? [resolve(ROOT, SINGLE_FILE)]
    : collectFiles(ROOT, ['.css']);

  const allFiles = SINGLE_FILE
    ? cssFiles
    : collectFiles(ROOT, ['.css', '.html', '.js']);

  // Run scans
  const allViolations = [];
  for (const f of cssFiles) {
    allViolations.push(...scanFile(f, tokenSets, valueIndex));
  }

  const unusedTokens = SINGLE_FILE ? [] : findUnusedTokens(tokens, allFiles);

  // ── JSON output ──
  if (JSON_OUTPUT) {
    console.log(JSON.stringify({
      hardcoded: allViolations,
      unused: unusedTokens,
      summary: {
        hardcoded_count: allViolations.length,
        unused_count: unusedTokens.length,
        files_scanned: cssFiles.length,
      },
    }, null, 2));
    process.exit(allViolations.length + unusedTokens.length > 0 ? 1 : 0);
    return;
  }

  // ── Console output ──
  console.log(`\n${c.C}${c.B}Token Compliance Audit${c.X}`);
  console.log(`${c.D}Scanned ${cssFiles.length} CSS files against ${tokens.size} tokens${c.X}\n`);

  // Group violations by file
  const byFile = new Map();
  for (const v of allViolations) {
    if (!byFile.has(v.file)) byFile.set(v.file, []);
    byFile.get(v.file).push(v);
  }

  if (byFile.size > 0) {
    console.log(`${c.R}${c.B}[HARDCODED]${c.X} ${allViolations.length} value(s) should use tokens:\n`);

    for (const [file, violations] of byFile) {
      console.log(`  ${c.B}${file}${c.X} (${violations.length})`);
      for (const v of violations) {
        const hint = FIX_HINTS && v.suggestion
          ? ` ${c.G}-> var(${v.suggestion})${c.X}`
          : '';
        console.log(`    ${c.D}L${v.line}${c.X} [${v.category}] ${c.Y}${v.raw}${c.X}${hint}`);
        if (FIX_HINTS) {
          console.log(`      ${c.D}${v.lineContent}${c.X}`);
        }
      }
      console.log();
    }

    // Category breakdown
    const byCat = {};
    for (const v of allViolations) {
      byCat[v.category] = (byCat[v.category] || 0) + 1;
    }
    console.log(`  ${c.D}By category:${c.X}`);
    for (const [cat, count] of Object.entries(byCat).sort((a, b) => b[1] - a[1])) {
      console.log(`    ${cat}: ${count}`);
    }
    console.log();
  }

  // Unused tokens
  if (unusedTokens.length > 0) {
    console.log(`${c.Y}${c.B}[UNUSED]${c.X} ${unusedTokens.length} token(s) defined but never referenced:\n`);
    // Group by section
    const bySection = new Map();
    for (const t of unusedTokens) {
      if (!bySection.has(t.section)) bySection.set(t.section, []);
      bySection.get(t.section).push(t);
    }
    for (const [section, toks] of bySection) {
      console.log(`  ${c.D}${section}:${c.X}`);
      for (const t of toks) {
        console.log(`    ${c.B}${t.name}${c.X}: ${t.value}`);
      }
    }
    console.log();
  }

  // Summary
  console.log(`${c.D}─────────────────────────────────────${c.X}`);
  const total = allViolations.length + unusedTokens.length;
  if (total === 0) {
    console.log(`${c.G}${c.B}All clear${c.X} — no compliance issues found.\n`);
  } else {
    console.log(`${c.R}${c.B}${total} issue(s)${c.X}  ${c.D}(${allViolations.length} hardcoded, ${unusedTokens.length} unused)${c.X}\n`);
  }

  process.exit(total > 0 ? 1 : 0);
}

main();
