import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const templateRoot = new URL("../", import.meta.url);

test("the public site uses Duevia RWA agentic investigation messaging", async () => {
  const [page, layout, agent, route] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/app/ai-investigator.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/agent/route.ts", import.meta.url), "utf8"),
  ]);
  assert.match(page, /Investigate assets/);
  assert.match(page, /always-on investigation agent/);
  assert.match(page, /Five agent capabilities/);
  assert.match(agent, /DUEVIA AI INVESTIGATOR/);
  assert.match(agent, /AI proposes/);
  assert.match(route, /OPENAI_API_KEY/);
  assert.match(route, /store: false/);
  assert.match(route, /AbortController/);
  assert.match(route, /Request body must be valid JSON/);
  assert.match(route, /Cache-Control.*no-store/);
  assert.match(layout, /Duevia RWA/);
  assert.doesNotMatch(page, /ProofFlow|Starter Project|codex-preview/);
});

test("the agent route applies bounded, validated model input", async () => {
  const route = await readFile(new URL("../app/api/agent/route.ts", import.meta.url), "utf8");
  assert.match(route, /slice\(0, 2000\)/);
  assert.match(route, /slice\(0, 30000\)/);
  assert.match(route, /answer\.slice\(0, 12000\)/);
  assert.match(route, /setTimeout\(\(\) => controller\.abort\(\), 15000\)/);
});

test("the temporary Sites skeleton is removed from the finished project", async () => {
  await assert.rejects(access(new URL("app/_sites-preview", templateRoot)));
});

test("the registry preserves private evidence and exposes eligibility", async () => {
  const contract = await readFile(new URL("../contracts/DueviaAssetAssuranceRegistry.sol", import.meta.url), "utf8");
  assert.match(contract, /evidenceRoot/);
  assert.match(contract, /policyHash/);
  assert.match(contract, /Raw evidence remains offchain/);
  assert.match(contract, /isEligible/);
});

test("the CREATE2 registry salt is exactly 32 bytes", async () => {
  const workspace = await readFile(new URL("../app/app/xray-workspace.tsx", import.meta.url), "utf8");
  const salt = workspace.match(/const registrySalt = `0x([0-9a-f]+)`/i)?.[1];
  assert.equal(salt?.length, 64);
});
