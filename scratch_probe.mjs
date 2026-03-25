import { inspectOpencode } from "./lib/gridnomad-store.js";

async function test() {
  const result = await inspectOpencode({ model: "opencode/minimax-m2.5-free" });
  console.log(JSON.stringify(result.probes.decision_probe, null, 2));
}

test().catch(console.error);
