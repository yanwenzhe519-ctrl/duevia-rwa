import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const templateRoot = new URL("../", import.meta.url);

test("the public site uses X-Ray RWA product metadata", async () => {
  const [page, layout] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(page, /See the risk behind/);
  assert.match(page, /Launch DApp/);
  assert.match(page, /Five callable modules/);
  assert.match(layout, /X-Ray RWA — Verify Before You Trust/);
  assert.doesNotMatch(page, /ProofFlow|Starter Project|codex-preview/);
});

test("the temporary Sites skeleton is removed from the finished project", async () => {
  await assert.rejects(access(new URL("app/_sites-preview", templateRoot)));
});

test("the proof registry preserves private evidence offchain", async () => {
  const contract = await readFile(new URL("../contracts/XRayProofRegistry.sol", import.meta.url), "utf8");
  assert.match(contract, /reportHash/);
  assert.match(contract, /previousReportHash/);
  assert.match(contract, /Private evidence stays offchain/);
  assert.match(contract, /ProofAnchored/);
});
