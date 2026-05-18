/**
 * Bundle genlayer-js for browser use.
 * Run: npm run bundle:wallet
 */
const esbuild = require("esbuild");
const fs = require("fs");

const src = "node_modules/genlayer-js/dist/index.js";
const out = "public/genlayer-js.js";

if (!fs.existsSync(src)) {
  console.error(`[bundle] Source not found: ${src}`);
  console.error(`[bundle] Run: npm install genlayer-js first`);
  process.exit(1);
}

esbuild
  .build({
    entryPoints: [src],
    bundle: true,
    format: "iife",
    globalName: "genlayer",
    outfile: out,
    minify: false,
    sourcemap: false,
    target: ["es2020"],
    define: {
      "process.env.NODE_ENV": '"browser"'
    },
    logLevel: "info"
  })
  .then(() => {
    // Patch the bundle to expose window.genlayer (IIFE result is in var genlayer)
    let content = fs.readFileSync(out, "utf8");
    const licenseIdx = content.lastIndexOf("/*! Bundled license");
    const beforeLicense = content.substring(0, licenseIdx).trimEnd();
    const afterLicense = content.substring(licenseIdx);
    // Remove old assignment if already present
    content =
      beforeLicense +
      '\nif (typeof window !== "undefined") window.genlayer = genlayer;\n' +
      afterLicense;
    fs.writeFileSync(out, content);
    const stats = fs.statSync(out);
    console.log(`[bundle] Created ${out} — ${(stats.size / 1024).toFixed(1)} KB`);
  })
  .catch((e) => {
    console.error("[bundle] Failed:", e.message);
    process.exit(1);
  });