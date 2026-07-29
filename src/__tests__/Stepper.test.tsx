/**
 * Tests for the multi-step form progress indicator (#475).
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Stepper, { type Step } from "@/components/ui/Stepper";

const steps: Step[] = [
  { label: "Details", status: "complete" },
  { label: "Recipients", status: "current" },
  { label: "Deadline", status: "upcoming" },
  { label: "Review", status: "upcoming" },
];

describe("Stepper", () => {
  test("renders every step label", () => {
    render(<Stepper steps={steps} />);

    for (const step of steps) {
      // Labels appear in the desktop trail; the mobile summary repeats the current one.
      expect(screen.getAllByText(step.label).length).toBeGreaterThan(0);
    }
  });

  test("exposes the step labels on the enclosing nav element", () => {
    render(<Stepper steps={steps} />);

    expect(screen.getByRole("navigation")).toHaveAttribute(
      "aria-label",
      "Progress: Details, Recipients, Deadline, Review"
    );
  });

  test("marks only the current step with aria-current", () => {
    const { container } = render(<Stepper steps={steps} />);

    const current = container.querySelectorAll('[aria-current="step"]');
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveTextContent("Recipients");
  });

  test("collapses to a 'Step N of M — Label' summary for small viewports", () => {
    render(<Stepper steps={steps} />);

    expect(screen.getByText("Step 2 of 4 — Recipients")).toBeInTheDocument();
  });

  test("completed steps are clickable and report their index", async () => {
    const onStepClick = jest.fn();
    render(<Stepper steps={steps} onStepClick={onStepClick} />);

    await userEvent.click(screen.getByRole("button", { name: /Go back to step 1: Details/i }));

    expect(onStepClick).toHaveBeenCalledWith(0);
  });

  test("current and upcoming steps are not clickable", () => {
    render(<Stepper steps={steps} onStepClick={jest.fn()} />);

    // Only the single completed step renders as a button.
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });

  test("renders a non-interactive trail when no handler is supplied", () => {
    render(<Stepper steps={steps} />);

    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  test("renders nothing for an empty step list", () => {
    const { container } = render(<Stepper steps={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  test("falls back to the last step when every step is complete", () => {
    render(<Stepper steps={steps.map((s) => ({ ...s, status: "complete" as const }))} />);

    expect(screen.getByText("Step 4 of 4 — Review")).toBeInTheDocument();
  });
});
