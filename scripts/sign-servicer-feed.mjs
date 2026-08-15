import { createHmac } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { canonicalServicerFeedPayload } from "../lib/servicer-feed-security.mjs";

const [inputPath, outputPath, secret = process.env.SERVICER_FEED_HMAC_SECRET] = process.argv.slice(2);
if (!inputPath || !outputPath || !secret) throw new Error("Usage: node scripts/sign-servicer-feed.mjs input.json output.json [secret]");
const feed = JSON.parse(await readFile(inputPath, "utf8"));
const unsigned = { ...feed };
delete unsigned.signature;
unsigned.signature = `hmac-sha256:${createHmac("sha256", secret).update(canonicalServicerFeedPayload(unsigned)).digest("hex")}`;
await writeFile(outputPath, `${JSON.stringify(unsigned, null, 2)}\n`);
console.log(`Signed ${outputPath}`);
