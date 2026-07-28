import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import InstallmentPlanBuilder from "@/components/invoice/InstallmentPlanBuilder";

describe("InstallmentPlanBuilder", () => {
  const defaultProps = {
    totalAmount: 1000,
    installments: [] as Array<{ id: string; amount: number; dueDate: number; status: string; txHash?: string }>,
    assetCode: "USDC" as const,
    onChange: () => {},
  };

  test("renders add milestone button", () => {
    render(<InstallmentPlanBuilder {...defaultProps} />);
    expect(screen.getByRole("button", { name: /add milestone/i })).toBeInTheDocument();
  });

  test("adds a milestone on click and can save when amounts match total", async () => {
    const onChange = jest.fn();
    render(<InstallmentPlanBuilder {...defaultProps} onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: /add milestone/i }));
    const inputs = screen.getAllByRole("spinbutton");
    await userEvent.clear(inputs[0]);
    await userEvent.type(inputs[0], "1000");
    const nextBtn = screen.getByRole("button", { name: /next/i });
    await userEvent.click(nextBtn);
    const saveBtn = screen.getByRole("button", { name: /save plan/i });
    await userEvent.click(saveBtn);
    expect(onChange).toHaveBeenCalled();
  });

  test("shows blocking validation when amounts do not sum to total", async () => {
    const onChange = jest.fn();
    render(<InstallmentPlanBuilder {...defaultProps} onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: /add milestone/i }));
    const inputs = screen.getAllByRole("spinbutton");
    await userEvent.clear(inputs[0]);
    await userEvent.type(inputs[0], "500");
    const nextBtn = screen.getByRole("button", { name: /next/i });
    await userEvent.click(nextBtn);
    expect(screen.getByRole("alert")).toHaveTextContent(/must sum to/i);
    expect(onChange).not.toHaveBeenCalled();
  });
});
