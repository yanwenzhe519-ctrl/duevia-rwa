import { scanXLayer } from "@/lib/xlayer-scanner.mjs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const addresses = url.searchParams.getAll("address").filter((address) => /^0x[0-9a-fA-F]{40}$/.test(address));
  try {
    const result = await scanXLayer({ fromBlock: url.searchParams.get("fromBlock") || undefined, toBlock: url.searchParams.get("toBlock") || undefined, addresses: addresses as never[] });
    return Response.json({ ok: true, ...result }, { headers: { "Cache-Control": "public, max-age=15" } });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : "X Layer scan failed." }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
