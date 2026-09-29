import { render, screen, fireEvent } from "@testing-library/react";
import InvoiceMilestoneCelebration from "@/components/milestones/InvoiceMilestoneCelebration";
import { fundedPercent, newestMilestone } from "@/lib/invoiceMilestones";

describe("invoice milestones", () => {
  it("computes funding and the newest milestone", () => {
    expect(fundedPercent(150, 100)).toBe(100);
    expect(fundedPercent(5, 0)).toBe(0);
    expect(newestMilestone(10, 100)).toBeNull();
    expect(newestMilestone(60, 100)?.percent).toBe(50);
  });

  it("celebrates the newest milestone and can be dismissed", () => {
    render(<InvoiceMilestoneCelebration raised={80} target={100} />);
    expect(screen.getByRole("status")).toHaveTextContent("75% funded");
    fireEvent.click(screen.getByText("Dismiss"));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("shows no banner before the first milestone", () => {
    render(<InvoiceMilestoneCelebration raised={10} target={100} />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
