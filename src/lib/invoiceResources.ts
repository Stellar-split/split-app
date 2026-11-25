export type ResourceCategory = "basics" | "payments" | "security" | "tips";

export interface InvoiceResource {
  id: string;
  title: string;
  summary: string;
  category: ResourceCategory;
  minutes: number;
  body: string[];
}

export const RESOURCE_CATEGORIES: { value: ResourceCategory; label: string }[] = [
  { value: "basics", label: "Basics" },
  { value: "payments", label: "Payments" },
  { value: "security", label: "Security" },
  { value: "tips", label: "Tips" },
];

export const INVOICE_RESOURCES: InvoiceResource[] = [
  {
    id: "what-is-a-split-invoice",
    title: "What is a split invoice?",
    summary: "How one invoice can be funded by several payers.",
    category: "basics",
    minutes: 3,
    body: [
      "A split invoice has one total amount and one or more recipients. Each payer contributes a share until the target is reached.",
      "Once the invoice is fully funded, the funds are released to the recipients according to their configured splits.",
    ],
  },
  {
    id: "reading-invoice-status",
    title: "Understanding invoice statuses",
    summary: "What pending, funded, released and expired mean.",
    category: "basics",
    minutes: 2,
    body: [
      "Pending invoices are still collecting contributions. Funded invoices have reached their target and are ready to release.",
      "Released invoices have paid out to recipients. Expired invoices passed their deadline before reaching the target.",
    ],
  },
  {
    id: "paying-with-a-wallet",
    title: "Paying an invoice with your wallet",
    summary: "Connect a Stellar wallet, review the fee and confirm.",
    category: "payments",
    minutes: 4,
    body: [
      "Connect your wallet from the pay page, then choose how much to contribute. The estimated network fee is shown before you sign.",
      "Confirm the transaction in your wallet. The invoice updates as soon as the payment is confirmed on the network.",
    ],
  },
  {
    id: "partial-payments",
    title: "Contributing part of the total",
    summary: "Pay your share now and let others cover the rest.",
    category: "payments",
    minutes: 2,
    body: [
      "You can contribute any amount up to the remaining balance. Your contribution is recorded even if the invoice is not yet fully funded.",
    ],
  },
  {
    id: "verify-before-you-pay",
    title: "Verify an invoice before paying",
    summary: "Check the recipient, amount and creator before you sign.",
    category: "security",
    minutes: 3,
    body: [
      "Confirm the recipient address and the total amount match what you expect. Look for a verified creator badge on the invoice.",
      "Never sign a transaction you were not expecting, and never share your wallet secret key with anyone.",
    ],
  },
  {
    id: "spotting-phishing-links",
    title: "Spotting phishing links",
    summary: "Make sure a payment link really belongs to the invoice creator.",
    category: "security",
    minutes: 3,
    body: [
      "Only open invoice links from people you know. Check the domain in the address bar before connecting your wallet.",
    ],
  },
  {
    id: "writing-clear-invoices",
    title: "Writing clear invoice descriptions",
    summary: "Help payers understand what they are paying for.",
    category: "tips",
    minutes: 2,
    body: [
      "Use a specific title and itemize line items. Clear descriptions reduce questions and speed up payment.",
    ],
  },
  {
    id: "choosing-a-deadline",
    title: "Choosing a sensible deadline",
    summary: "Balance urgency with enough time for payers to act.",
    category: "tips",
    minutes: 2,
    body: [
      "Give payers at least several days when contributions come from multiple people. Send a reminder as the deadline approaches.",
    ],
  },
];

export interface ResourceFilter {
  query?: string;
  category?: ResourceCategory | "all";
}

export function filterResources(
  resources: InvoiceResource[],
  { query = "", category = "all" }: ResourceFilter = {},
): InvoiceResource[] {
  const needle = query.trim().toLowerCase();
  return resources.filter((r) => {
    if (category !== "all" && r.category !== category) return false;
    if (!needle) return true;
    return (
      r.title.toLowerCase().includes(needle) ||
      r.summary.toLowerCase().includes(needle) ||
      r.body.some((p) => p.toLowerCase().includes(needle))
    );
  });
}
