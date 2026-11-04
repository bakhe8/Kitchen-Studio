// `npm test`: runs every tools/check-*.mjs and scripts/check-*.mjs. Each one is a plain assert script, so exit code 0 means pass.
// The checks never touch real projects or stock; they read only the repository and use in-memory SQLite.
// usage: node scripts/run-checks.mjs [--only=<text in the file name>] [--jobs=6] [--timeout=<seconds, default 180>]
import { spawn } from "node:child_process";
import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const option = (name, fallback) => process.argv.find((a) => a.startsWith("--" + name + "="))?.slice(name.length + 3) ?? fallback;
const only = option("only", "");
const jobs = Math.max(1, Number(option("jobs", 6)) || 6);
const timeoutMs = Math.max(1, Number(option("timeout", 180)) || 180) * 1000;
const checks = ["tools", "scripts"]
  .flatMap((dir) => readdirSync(path.join(root, dir)).filter((f) => /^check-.*\.mjs$/.test(f)).map((f) => path.join(dir, f)))
  .filter((f) => f.includes(only))
  .sort();
if (!checks.length) {
  console.error("No checks match --only=" + only);
  process.exit(2);
}

// The four server checks each rebuild lib/generated-shop-domain.mjs before importing it. Side by side, one process can read
// that file while another is rewriting it (a spurious 400 from the save route). They run one at a time first; the rest in parallel.
const serial = checks.filter((f) => f.startsWith("scripts" + path.sep));
const parallel = checks.filter((f) => !serial.includes(f));
const failures = [];
let next = 0, done = 0;
const tail = (text, lines) => text.trim().split("\n").slice(-lines).join("\n");

function run(file) {
  return new Promise((resolve) => {
    const started = Date.now();
    const child = spawn(process.execPath, ["--no-warnings", file], { cwd: root, env: { ...process.env, NO_COLOR: "1" } });
    let output = "", timedOut = false;
    const keep = (chunk) => { output = (output + chunk).slice(-8000); };
    child.stdout.on("data", keep);
    child.stderr.on("data", keep);
    const timer = setTimeout(() => { timedOut = true; child.kill("SIGKILL"); }, timeoutMs);
    child.on("error", (error) => { output += String(error); });
    child.on("close", (code) => {
      clearTimeout(timer);
      done++;
      const ok = code === 0 && !timedOut;
      if (!ok) failures.push({ file, code: timedOut ? "timeout" : code, output });
      console.log(`${ok ? "PASS" : "FAIL"} ${String(done).padStart(3)}/${checks.length} ${file} (${((Date.now() - started) / 1000).toFixed(1)}s)`);
      resolve();
    });
  });
}

async function worker() {
  while (next < parallel.length) await run(parallel[next++]);
}
for (const file of serial) await run(file);
await Promise.all(Array.from({ length: Math.min(jobs, parallel.length) }, worker));

for (const f of failures) console.error(`\n--- ${f.file} (${f.code}) ---\n${tail(f.output, 14)}`);
console.log(`\n${checks.length - failures.length}/${checks.length} checks passed.`);
process.exitCode = failures.length ? 1 : 0;
