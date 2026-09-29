import { render, screen, fireEvent, within } from "@testing-library/react";
import PayerSegmentation from "@/components/analytics/PayerSegmentation";
import {
  championThreshold,
  classifyPayer,
  segmentPayers,
  summarizeSegments,
  type PayerRecord,
} from "@/lib/payerSegmentation";

const now = Date.parse("2026-06-30T00:00:00Z");
const daysAgo = (n: number) => new Date(now - n * 24 * 60 * 60 * 1000).toISOString();

const payer = (address: string, overrides: Partial<PayerRecord>): PayerRecord => ({
  address,
  totalPaid: 10,
  paymentCount: 1,
  firstPaidAt: daysAgo(200),
  lastPaidAt: daysAgo(5),
  ...overrides,
});

describe("classifyPayer", () => {
  it("marks payers with no payment in over 90 days as lapsed", () => {
    expect(classifyPayer(payer("a", { lastPaidAt: daysAgo(120) }), now, 0)).toBe("lapsed");
  });

  it("marks payers quiet for 31-90 days as at-risk", () => {
    expect(classifyPayer(payer("a", { lastPaidAt: daysAgo(45) }), now, 0)).toBe("at-risk");
  });

  it("marks recent first-time payers as new", () => {
    expect(classifyPayer(payer("a", { firstPaidAt: daysAgo(3), lastPaidAt: daysAgo(3) }), now, 0)).toBe("new");
  });

  it("marks frequent, high-value, recent payers as champions", () => {
    expect(classifyPayer(payer("a", { paymentCount: 8, totalPaid: 500 }), now, 100)).toBe("champions");
  });

  it("marks frequent but lower-value payers as loyal", () => {
    expect(classifyPayer(payer("a", { paymentCount: 8, totalPaid: 50 }), now, 100)).toBe("loyal");
    expect(classifyPayer(payer("a", { paymentCount: 3 }), now, 100)).toBe("loyal");
  });

  it("marks recent occasional payers as casual", () => {
    expect(classifyPayer(payer("a", { paymentCount: 2 }), now, 100)).toBe("casual");
  });
});

describe("championThreshold", () => {
  it("is 0 for no payers and the 75th percentile otherwise", () => {
    expect(championThreshold([])).toBe(0);
    const payers = [10, 20, 30, 40].map((t, i) => payer(`p${i}`, { totalPaid: t }));
    expect(championThreshold(payers)).toBe(30);
  });
});

describe("summarizeSegments", () => {
  it("counts members, totals and shares per segment", () => {
    const segmented = segmentPayers(
      [
        payer("a", { lastPaidAt: daysAgo(120), totalPaid: 40 }),
        payer("b", { lastPaidAt: daysAgo(150), totalPaid: 60 }),
        payer("c", { paymentCount: 2, totalPaid: 5 }),
        payer("d", { lastPaidAt: daysAgo(45) }),
      ],
      now,
    );
    const summary = summarizeSegments(segmented);
    const lapsed = summary.find((s) => s.segment === "lapsed")!;
    expect(lapsed.count).toBe(2);
    expect(lapsed.totalPaid).toBe(100);
    expect(lapsed.share).toBe(0.5);
    expect(summary.reduce((n, s) => n + s.count, 0)).toBe(4);
  });

  it("returns zero shares for no payers", () => {
    expect(summarizeSegments([]).every((s) => s.count === 0 && s.share === 0)).toBe(true);
  });
});

describe("PayerSegmentation", () => {
  const payers = [
    payer("GLAPSED", { lastPaidAt: daysAgo(200) }),
    payer("GCASUAL", { paymentCount: 2 }),
  ];

  it("shows an empty state", () => {
    render(<PayerSegmentation payers={[]} now={now} />);
    expect(screen.getByRole("status")).toHaveTextContent("No payers to segment yet.");
  });

  it("lists payers with their segment and filters by segment", () => {
    render(<PayerSegmentation payers={payers} now={now} />);
    expect(screen.getByText("GLAPSED")).toBeInTheDocument();
    expect(screen.getByText("GCASUAL")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Segment"), { target: { value: "lapsed" } });
    expect(screen.getByText("GLAPSED")).toBeInTheDocument();
    expect(screen.queryByText("GCASUAL")).not.toBeInTheDocument();
    expect(within(screen.getByRole("list")).getByTestId("segment-label")).toHaveTextContent("Lapsed");
  });

  it("filters when a segment card is toggled", () => {
    render(<PayerSegmentation payers={payers} now={now} />);
    const casualCard = screen.getByRole("button", { name: /Casual/ });
    fireEvent.click(casualCard);
    expect(casualCard).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByText("GLAPSED")).not.toBeInTheDocument();
    fireEvent.click(casualCard);
    expect(screen.getByText("GLAPSED")).toBeInTheDocument();
  });
});
