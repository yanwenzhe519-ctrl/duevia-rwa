export const demoCase = {
  caseId: "INV-2026-0814-07",
  asOf: "2026-08-14T12:00:00.000Z",
  asset: {
    name: "Nova Components Receivable #07",
    type: "Trade receivable",
    currency: "USDT",
    requestedAmount: 48600,
    reportedValue: 48600,
    tokenSupply: 48600,
    unitValue: 1,
    policyId: "TRADE_RECEIVABLES_V1",
  },
  issuer: {
    legalName: "Hangzhou Nova Components Ltd.",
    jurisdiction: "CN",
    registrationStatus: "active",
    kybStatus: "verified",
    sanctionsStatus: "clear",
    bankAccountHolder: "Wei Chen",
    lastVerifiedAt: "2026-08-12T09:30:00.000Z",
  },
  monitoring: {
    lastUpdatedAt: "2026-08-12T09:30:00.000Z",
    cadence: "daily",
    validUntil: "2026-08-15T09:30:00.000Z",
  },
  documents: [
    { type: "invoice", name: "Invoice_INV-0814.pdf", issuer: "Hangzhou Nova Components Ltd.", amount: 48600, currency: "USDT", dueDate: "2026-08-16" },
    { type: "purchase_order", name: "PO_NOVA-4471.pdf", supplier: "Hangzhou Nova Components Ltd.", amount: 48600, currency: "USDT", deliveryDate: "2026-08-18" },
    { type: "delivery_proof", name: "Delivery_DN-4471.pdf", amount: 48600, currency: "USDT", acceptedAt: "2026-08-18" },
    { type: "payment_instruction", name: "Payment_Instruction.pdf", accountHolder: "Wei Chen", amount: 48600, currency: "USDT" },
  ],
};
