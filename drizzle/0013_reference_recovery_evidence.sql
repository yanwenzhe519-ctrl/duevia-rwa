UPDATE projects
SET snapshot_json = '{"poolId":"DUEVIA-RCV-018","servicerId":"DUEVIA-REFERENCE-SERVICER","capturedAt":"2026-08-16T12:04:31.811Z","source":"signed-reference-servicer-feed","currency":"USDT","assets":[{"assetId":"NOVA-RCV-07","invoiceId":"INV-0814","debtor":"Nova Buyer Treasury","bankAccount":"DUEVIA-CONTROLLED-COLLECTION","faceValue":"48600","outstanding":"48600","reportedClosing":"40000","currency":"USDT","decimals":2,"documentHash":"sha256:duevia-reference-invoice-inv-0814"}]}',
    updated_at = CURRENT_TIMESTAMP
WHERE pool_id = 'DUEVIA-RCV-018';

INSERT OR IGNORE INTO observations (
  observation_id, pool_id, source, kind, observed_at, block_number, transaction_hash, payload_json
) VALUES (
  'reference-payment:INV-0814:20260819',
  'DUEVIA-RCV-018',
  'signed-reference-servicer-feed',
  'PAYMENT',
  '2026-08-19T09:15:00.000Z',
  NULL,
  NULL,
  '{"eventId":"reference-payment:INV-0814:20260819","evidenceId":"reference-payment:INV-0814:20260819","type":"PAYMENT","assetId":"NOVA-RCV-07","invoiceId":"INV-0814","amount":"8600","currency":"USDT","payer":"Nova Buyer Treasury","beneficiaryAccount":"DUEVIA-CONTROLLED-COLLECTION","status":"confirmed","observedAt":"2026-08-19T09:15:00.000Z","source":"signed-reference-servicer-feed","testnetReference":true}'
);

INSERT OR IGNORE INTO observations (
  observation_id, pool_id, source, kind, observed_at, block_number, transaction_hash, payload_json
) VALUES (
  'xlayer-final-rehearsal:38591900',
  'DUEVIA-RCV-018',
  'xlayer-rpc',
  'VERIFIED_DEPOSIT_ACCEPTED',
  '2026-08-20T00:00:00.000Z',
  '38591900',
  '0xbc35fcf72a84353db732c9f1fe85c39fdb2be34d6bdead6ef924288c2dfb0363',
  '{"eventId":"xlayer-final-rehearsal:38591900","evidenceId":"xlayer-final-rehearsal:38591900","event":"VERIFIED_DEPOSIT_ACCEPTED","assetId":"NOVA-RCV-07","invoiceId":"INV-0814","transactionHash":"0xbc35fcf72a84353db732c9f1fe85c39fdb2be34d6bdead6ef924288c2dfb0363","blockNumber":"38591900","observedAt":"2026-08-20T00:00:00.000Z","source":"xlayer-rpc","testnetReference":true}'
);
