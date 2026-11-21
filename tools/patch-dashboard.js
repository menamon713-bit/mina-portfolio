"use strict";

// Usage (from the repo root):  node tools/patch-dashboard.js
//
// Fixes two things in your existing files, without rewriting them:
//  1. dashboard.js: the skills progress bar used an inline style="..."
//     attribute, which your CSP (style-src-attr 'none') blocks, so the bars
//     rendered empty. The width is now set from JS (allowed by the CSP).
//  2. dashboard.css: message text now keeps line breaks and wraps long words.
//
// Safe to run twice. Creates dashboard.js.bak / dashboard.css.bak first.

const fs = require("fs");
const path = require("path");

const root = process.cwd();
const jsPath = path.join(root, "dashboard.js");
const cssPath = path.join(root, "dashboard.css");

function fail(message) {
  console.error(`ERROR: ${message}`);
  process.exit(1);
}

if (!fs.existsSync(jsPath)) {
  fail("dashboard.js not found. Run this from the repo root.");
}

/* ---------- dashboard.js ---------- */

let js = fs.readFileSync(jsPath, "utf8");

if (js.includes("data-progress")) {
  console.log("dashboard.js: already patched, skipping.");
} else {
  const styleSpan =
    /<span style="width:\$\{Math\.max\(\s*0,\s*Math\.min\(100,\s*Number\(skill\.progress\)\s*\|\|\s*0\)\s*\)\}%"><\/span>/g;

  const matches = js.match(styleSpan) || [];

  if (matches.length !== 1) {
    fail(
      `expected 1 inline progress style, found ${matches.length}. ` +
        "File differs from the version I reviewed; edit it by hand."
    );
  }

  // NOTE: replacements are passed as functions on purpose. A plain string
  // would make String.replace turn every "$$" into a single "$".
  const progressSpan =
    '<span data-progress="${Math.max(0, Math.min(100, Number(skill.progress) || 0))}"></span>';

  js = js.replace(styleSpan, () => progressSpan);

  const anchor = '$$("[data-skill-edit]", tbody)';

  if (js.split(anchor).length !== 2) {
    fail("could not find the skill-edit listener anchor exactly once.");
  }

  const widthSetter = `// CSP-safe: set widths through the CSSOM instead of an inline style attribute.
    $$("[data-progress]", tbody).forEach((element) => {
      element.style.width = \`\${element.dataset.progress}%\`;
    });

    ${anchor}`;

  js = js.replace(anchor, () => widthSetter);

  fs.copyFileSync(jsPath, `${jsPath}.bak`);
  fs.writeFileSync(jsPath, js);

  console.log("dashboard.js: patched (backup: dashboard.js.bak).");
}

/* ---------- dashboard.css ---------- */

const marker = "/* mash-security-update: message text */";

const cssAddition = `
${marker}
.message-detail p {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
`;

if (!fs.existsSync(cssPath)) {
  console.log("dashboard.css not found, skipping CSS (add the rule by hand).");
} else {
  const css = fs.readFileSync(cssPath, "utf8");

  if (css.includes(marker)) {
    console.log("dashboard.css: already patched, skipping.");
  } else {
    fs.copyFileSync(cssPath, `${cssPath}.bak`);
    fs.appendFileSync(cssPath, cssAddition);

    console.log("dashboard.css: patched (backup: dashboard.css.bak).");
  }
}
