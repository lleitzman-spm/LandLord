#!/usr/bin/env node
// leakcheck.mjs — refuse to let a secret or a real person into a public repo.
//
//   node tools/leakcheck.mjs            # scan tracked files, report, exit 1 on any finding
//   node tools/leakcheck.mjs --list     # list what would be scanned, and stop
//
// WHY THIS EXISTS. This repository was carved out of a private one that held a real
// company's operations: staff names, third-party personal e-mail addresses, a live
// error-reporting key, a database project reference, and an identity-wall audience tag.
// All of that was removed by hand before the first public commit. Hand work is a
// point-in-time guarantee, and this repo is open to contributors, so the guarantee has
// to be continuous instead. A pull request should be told it is carrying a key before a
// human ever reads it.
//
// WHAT IT IS NOT. It is a NET, not a proof. It catches shapes — an address, a key, a
// token — and a determined leak in an unfamiliar shape will pass it. Passing this check
// is necessary and nowhere near sufficient; a reviewer still reads the diff.
//
// WHY IT HOLDS NO DENYLIST OF REAL VALUES. The obvious design is a list of the exact
// names and keys to look for. That design publishes them. A file enumerating the very
// strings you are hiding is the leak, committed and searchable, and every fork keeps a
// copy. So this tool knows only SHAPES, never a single real value. The one-time sweep
// against the actual literals happened privately, before the repo existed, and its list
// was never committed anywhere.
//
// BINARIES AND IMAGES ARE THE BLIND SPOT, AND IT IS A REAL ONE. A picture can carry a
// place name rendered into its pixels; an elevation file can carry coordinates in its
// header. Both pass every text scan ever written — that is not a hypothetical, it is
// exactly how a county map nearly reached this repo. This tool therefore does not
// pretend to clear binaries. It LISTS them and requires a human to have looked. See the
// BINARY REVIEW section at the bottom of its output.
//
// Pure Node — no dependencies, so CI needs nothing installed.

import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const argv = process.argv.slice(2);
const LIST_ONLY = argv.includes("--list");

// ── what counts as a finding ────────────────────────────────────────────────
//
// Every rule carries the reason it exists, because a contributor who trips one deserves
// to know what the tool is worried about rather than just being told "no".

const RULES = [
  {
    id: "email",
    what: "an e-mail address",
    // Anything not at a documentation domain. RFC 2606 and RFC 6761 reserve example.com,
    // example.org, example.net, .example, .invalid, .test and .localhost precisely so
    // that documentation has addresses that can never belong to a real person.
    re: /\b[A-Za-z0-9._%+-]+@(?!(?:[A-Za-z0-9-]+\.)*(?:example\.(?:com|org|net)|test|invalid|localhost|local)\b)[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
    why: "A real address belongs to a real person who did not consent to being published. Use an address at example.com.",
  },
  {
    id: "sentry-dsn",
    what: "an error-reporting ingest key",
    re: /https?:\/\/[0-9a-f]{16,}@[\w.-]*ingest[\w.-]*\.[a-z]{2,}\/\d+/gi,
    why: "It is a write credential for someone's error inbox. Read it from the environment.",
  },
  {
    id: "supabase-host",
    what: "a database project host",
    re: /\b[a-z]{16,}\.supabase\.(?:co|in)\b/g,
    why: "It names a specific live project. Read the URL from the environment.",
  },
  {
    id: "access-team",
    what: "an identity-wall team domain",
    re: /\b[\w-]+\.cloudflareaccess\.com\b/g,
    why: "It identifies a specific organisation's login wall. Configuration, not source.",
  },
  {
    id: "api-key",
    what: "an API key",
    // Common vendor prefixes. Deliberately narrow: a broad "long random string" rule
    // fires on hashes, minified code and lockfile integrity fields, and a check that
    // cries wolf gets switched off, which is worse than not having it.
    re: /\b(?:sk|pk|rk|sb|ghp|gho|ghu|ghs|ghr|xox[abposr])[-_][A-Za-z0-9_-]{16,}\b/g,
    why: "Keys are read from the environment, never committed — not even revoked ones.",
  },
  {
    id: "jwt",
    what: "a JSON Web Token",
    re: /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,
    why: "A token is a credential even after it expires — it reveals structure and claims.",
  },
  {
    id: "private-key",
    what: "a private key block",
    re: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----/g,
    why: "Never. Not a test key, not an example key.",
  },
  {
    id: "aws-key",
    what: "an AWS access key id",
    re: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g,
    why: "Read it from the environment.",
  },
  {
    id: "phone",
    what: "what looks like a real telephone number",
    // North American shapes, and the separator is REQUIRED — parentheses, a hyphen or a
    // dot. An earlier version made every separator optional, which meant it matched any
    // ten consecutive digits and duly reported the FNV-1a prime 2166136261, the constant
    // 4294967296 (2^32) and a space-separated series of token counts as telephone
    // numbers. Nine findings, nine wrong. That is worse than no rule at all: a check
    // that cries wolf is a check somebody turns off, and it takes the true findings with
    // it. Space-separated numbers are therefore deliberately NOT matched — in source and
    // in prose they are nearly always data, and missing one committed phone number is a
    // cheaper mistake than training a reader to skip this tool's output.
    // 555-01xx is reserved by the NANP so fiction cannot dial a stranger; it is allowed.
    re: /(?<![\d.])(?:\+1[-. ])?(?:\(([2-9]\d{2})\)[-. ]?|([2-9]\d{2})[-.])(?!555[-.]?01)([2-9]\d{2})[-.](\d{4})(?![\d.])/g,
    why: "Use a 555-01xx number — the range reserved so fiction cannot dial a stranger.",
  },
];

// Paths where a match is expected and harmless: this file defines the patterns, and the
// contributor guide has to be able to show an example of what not to do.
const EXEMPT = [/^tools\/leakcheck\.mjs$/, /^CONTRIBUTING\.md$/, /^SECURITY\.md$/];

const BINARY_EXT = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif", ".ico", ".bmp", ".tiff",
  ".bin", ".dat", ".glb", ".gltf", ".fbx", ".obj", ".wasm", ".zip", ".gz",
  ".pdf", ".mp3", ".wav", ".ogg", ".mp4", ".webm", ".woff", ".woff2", ".ttf", ".otf",
]);

// ── gather ──────────────────────────────────────────────────────────────────

function trackedFiles() {
  try {
    return execFileSync("git", ["ls-files", "-z"], { cwd: ROOT, maxBuffer: 1 << 28 })
      .toString()
      .split("\0")
      .filter(Boolean);
  } catch {
    console.error("  leakcheck: not a git repository, or git is unavailable.");
    process.exit(2);
  }
}

const files = trackedFiles();
if (LIST_ONLY) {
  for (const f of files) console.log(f);
  process.exit(0);
}

// ── scan ────────────────────────────────────────────────────────────────────

let findings = 0;
const binaries = [];
let scanned = 0;

for (const rel of files) {
  const ext = path.extname(rel).toLowerCase();
  let size = 0;
  try {
    size = statSync(path.join(ROOT, rel)).size;
  } catch {
    continue; // listed but absent — a broken index is not this tool's problem to report
  }

  if (BINARY_EXT.has(ext)) {
    binaries.push({ rel, size });
    continue;
  }
  if (size > 8 * 1024 * 1024) {
    binaries.push({ rel, size, note: "very large text — not scanned" });
    continue;
  }
  if (EXEMPT.some((re) => re.test(rel))) continue;

  let text;
  try {
    text = readFileSync(path.join(ROOT, rel), "utf8");
  } catch {
    binaries.push({ rel, size, note: "unreadable as text" });
    continue;
  }
  // A NUL byte means it is binary whatever its extension claims.
  if (text.includes("\0")) {
    binaries.push({ rel, size, note: "binary content despite a text extension" });
    continue;
  }
  scanned++;

  const lines = text.split("\n");
  for (const rule of RULES) {
    for (let i = 0; i < lines.length; i++) {
      rule.re.lastIndex = 0;
      const line = lines[i] ?? "";
      let m;
      while ((m = rule.re.exec(line)) !== null) {
        findings++;
        // The finding is REDACTED in the output on purpose. CI logs are often public,
        // and a tool that prints the secret it just caught has published it a second
        // time, to a wider audience, in a place nobody thinks to clean.
        const hit = m[0];
        const shown =
          hit.length <= 6 ? "*".repeat(hit.length) : `${hit.slice(0, 3)}${"*".repeat(Math.min(hit.length - 4, 20))}${hit.slice(-1)}`;
        console.log(`  ✗ ${rel}:${i + 1}  ${rule.what}  [${shown}]`);
        console.log(`      ${rule.why}`);
      }
    }
  }
}

// ── report ──────────────────────────────────────────────────────────────────

console.log("");
console.log(`  leakcheck — ${scanned} text file(s) scanned, ${findings} finding(s)`);

if (binaries.length) {
  console.log("");
  console.log("  BINARY REVIEW — not scanned, and NOT cleared by this tool");
  console.log("  A picture can carry a place name in its pixels and an elevation file can");
  console.log("  carry coordinates in its header. Both pass every text scan. Someone has to");
  console.log("  have opened these and looked:");
  for (const b of binaries.slice(0, 40)) {
    const kb = (b.size / 1024).toFixed(0);
    console.log(`    · ${b.rel}  (${kb} KB)${b.note ? ` — ${b.note}` : ""}`);
  }
  if (binaries.length > 40) console.log(`    … and ${binaries.length - 40} more`);
}

if (findings) {
  console.log("");
  console.log("  FAILED — the values above are redacted here on purpose. Find them in the");
  console.log("  file, remove them at the source, and never paste one into a CI log or an");
  console.log("  issue. If a secret was ever committed, ROTATE IT: removing it from the");
  console.log("  working tree does not remove it from the history, and history is public.");
  process.exit(1);
}

console.log("  PASSED — no credential or personal-data shape found in tracked text.");
console.log("  This is a net, not a proof. A reviewer still reads the diff.");
process.exit(0);
