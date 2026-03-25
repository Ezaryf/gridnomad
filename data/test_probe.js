import { spawn } from "node:child_process";

export async function runCommand(command, args, { cwd = process.cwd(), env = process.env, timeoutMs = 20000, input = "" } = {}) {
  return new Promise((resolve) => {
    const isWindows = process.platform === "win32";
    const child = spawn(command, args, { cwd, env, shell: false, windowsHide: true });
    let stdout = ""; let stderr = ""; let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        child.kill(); settled = true;
        resolve({ code: 124, stdout, stderr: `${stderr}\nTimed out after ${timeoutMs}ms`.trim() });
      }
    }, timeoutMs);
    child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    child.on("close", (code) => {
      if (settled) return;
      clearTimeout(timer); settled = true;
      resolve({ code: code ?? 0, stdout, stderr });
    });
    if (input) { child.stdin.write(input); }
    if (child.stdin) { child.stdin.end(); }
  });
}

function quoteWindowsArgument(value) {
  if (!value.includes(" ") && !value.includes('"')) {
    return value;
  }
  return `"${value.replace(/"/g, '\\"')}"`;
}

(async () => {
    const credential = "sk-Dh5Wuk1znM9pbV2lv61RwPVN3ZzcovIlaZ0X1Jvz1kYl2Wlyy3ua7v9vTp0nyxT7";
    const env = { ...process.env, OPENCODE_PROVIDER: credential };
    let args = ["run", "--dir", process.cwd(), "--format", "json", "--title", "GridNomad probe", "-m", "opencode/minimax-m2.5-free", "Reply with READY and nothing else."];
    args = args.map(quoteWindowsArgument);
    console.log("Running opencode", args.join(" "));
    const result = await runCommand("opencode", args, { env, timeoutMs: 30000 });
    console.log("Exit code:", result.code);
    console.log("Stdout slice:", result.stdout.slice(0, 500));
    console.log("Stderr slice:", result.stderr.slice(0, 500));
})();
