#!/usr/bin/env node
/**
 * apply-branding.mjs
 *
 * Re-applies reactor-gui branding over any upstream pi-gui strings that may
 * have been introduced by a merge. Safe to run repeatedly (idempotent).
 *
 * Rules:
 *   - Internal npm package names (@pi-gui/*) are NOT touched — they are
 *     workspace package identifiers, not visible product names.
 *   - The pi SDK dependency (@mariozechner/pi-coding-agent, PI_MONO_URL) is
 *     NOT touched — it is the upstream runtime we depend on.
 *   - Only visible product name references are rebranded.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// ── Replacement map ──────────────────────────────────────────────────────────
// Order matters: longer/more-specific patterns first
const REPLACEMENTS = [
  // Homebrew tap references
  ["minghinmatthewlam/homebrew-tap", "hyperspace-technologies/homebrew-tap"],
  ["minghinmatthewlam/tap", "hyperspace-technologies/tap"],
  // Homebrew cask name
  ["brew install --cask pi-gui", "brew install --cask reactor-gui"],
  ["brew upgrade --cask pi-gui", "brew upgrade --cask reactor-gui"],
  // GitHub repo references (upstream owner)
  ["https://github.com/minghinmatthewlam/pi-gui", "https://github.com/DrOlu/reactor-gui"],
  // App bundle / binary names (visible to user)
  ["pi-gui-notification-status-helper", "reactor-gui-notification-status-helper"],
  ["pi-gui-packaged-runtime-", "reactor-gui-packaged-runtime-"],
  ["pi-gui-demo-user-data-", "reactor-gui-demo-user-data-"],
  ["pi-gui-demo-frames-", "reactor-gui-demo-frames-"],
  ['"pi-gui.app"', '"reactor-gui.app"'],
  // Electron builder / package metadata
  ['appId: com.pi-gui.desktop', 'appId: com.reactor-gui.desktop'],
  ['productName: pi-gui', 'productName: reactor-gui'],
  ['copyright: Copyright 2026 Matthew Lam', 'copyright: Copyright 2026 Hyperspace Technologies'],
  ['"name": "pi-gui"', '"name": "reactor-gui"'],
  ['"author": "Matthew Lam"', '"author": "Hyperspace Technologies <reactor@hyperspace.ng>"'],
  // Electron app.setName
  ['app.setName("pi")', 'app.setName("reactor")'],
  // Visible UI strings (dialog titles, log messages, notifications)
  ['"pi-gui Release Available"', '"reactor-gui Release Available"'],
  ['"pi-gui"', '"reactor-gui"'],          // dialog title: "pi-gui"
  ['`[pi-gui]', '`[reactor-gui]'],
  ['"Observed working in pi-gui."', '"Observed working in reactor-gui."'],
  ['in pi-gui yet.', 'in reactor-gui yet.'],
  // Website / marketing
  ['SITE_NAME = "pi-gui"', 'SITE_NAME = "reactor-gui"'],
  ['SITE_URL = "https://www.pi-gui.com"', 'SITE_URL = "https://www.reactor-gui.com"'],
  ['OG_IMAGE_ALT = "pi-gui desktop app preview"', 'OG_IMAGE_ALT = "reactor-gui desktop app preview"'],
  ['"pi-gui — A native desktop for AI coding agents"', '"reactor-gui — A native desktop for AI coding agents"'],
  ['nav-logo">pi-gui', 'nav-logo">reactor-gui'],
  ['<span>pi-gui</span>', '<span>reactor-gui</span>'],
  // README visible text
  ['cd pi-gui', 'cd reactor-gui'],
  // Linux executableName
  ['executableName: pi-gui', 'executableName: reactor-gui'],
  // electron-builder publish
  ['owner: minghinmatthewlam', 'owner: DrOlu'],
  ['repo: pi-gui', 'repo: reactor-gui'],
  // publish in release.yml (in case it's regenerated)
  ['"repo": "pi-gui"', '"repo": "reactor-gui"'],
  ['"owner": "minghinmatthewlam"', '"owner": "DrOlu"'],
];

// ── Files to process ─────────────────────────────────────────────────────────
const INCLUDE_PATTERNS = [
  "**/*.ts",
  "**/*.tsx",
  "**/*.mts",
  "**/*.mjs",
  "**/*.js",
  "**/*.json",
  "**/*.yml",
  "**/*.yaml",
  "**/*.md",
  "**/*.css",
  "**/*.plist",
];

const EXCLUDE_DIRS = [
  "node_modules",
  ".git",
  "out",
  "release",
  "build",
  "patches",
  "video",
];

// ── Utilities ─────────────────────────────────────────────────────────────────
function getAllFiles(dir) {
  const results = [];
  let entries;
  try {
    entries = execSync(`find "${dir}" -type f`, { encoding: "utf8", cwd: ROOT })
      .split("\n")
      .filter(Boolean);
  } catch {
    return results;
  }
  for (const entry of entries) {
    const rel = entry.startsWith(dir) ? entry.slice(dir.length + 1) : entry;
    // Skip excluded dirs
    if (EXCLUDE_DIRS.some((ex) => rel.startsWith(ex + "/") || rel === ex)) continue;
    // Only process text files matching include patterns
    const ext = rel.split(".").pop() ?? "";
    const wantedExts = ["ts", "tsx", "mts", "mjs", "js", "json", "yml", "yaml", "md", "css", "plist"];
    if (!wantedExts.includes(ext)) continue;
    results.push(entry);
  }
  return results;
}

function applyReplacements(content) {
  let result = content;
  for (const [from, to] of REPLACEMENTS) {
    // Use split/join for literal replacement (no regex needed)
    result = result.split(from).join(to);
  }
  return result;
}

// ── Main ──────────────────────────────────────────────────────────────────────
let changed = 0;
let scanned = 0;

const files = getAllFiles(ROOT);
for (const filePath of files) {
  let content;
  try {
    content = readFileSync(filePath, "utf8");
  } catch {
    continue; // skip binary or unreadable
  }
  scanned++;
  const updated = applyReplacements(content);
  if (updated !== content) {
    writeFileSync(filePath, updated, "utf8");
    console.log(`  patched: ${filePath.replace(ROOT + "/", "")}`);
    changed++;
  }
}

console.log(`\nBranding patch complete: ${changed} file(s) updated, ${scanned} scanned.`);
