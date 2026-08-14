import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const templateRoot = new URL("../", import.meta.url);

test("the public site uses Duevia RWA asset assurance messaging", async () => {
  const [page, layout] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(page, /Verify what/);
  assert.match(page, /Asset assurance/);
  assert.match(page, /Five capabilities/);
  assert.match(layout, /Duevia RWA/);
  assert.doesNotMatch(page, /ProofFlow|Starter Project|codex-preview/);
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
