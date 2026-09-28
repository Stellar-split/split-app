import React from "react";
import { render, screen } from "@testing-library/react";
import VerifiedCreatorBadge, {
  formatVerificationDate,
} from "@/components/VerifiedCreatorBadge";

const state = vi.hoisted(() => ({
  verified: false,
  attestation: null as null | {
    address: string;
    signature: string;
    timestamp?: number;
    method?: string;
  },
}));

vi.mock("@/lib/attestation", () => ({
  isVerifiedCreator: () => state.verified,
  getAttestation: () => state.attestation,
  getAttestations: () => ({}),
  storeAttestation: () => {},
  removeAttestation: () => {},
  generateChallenge: () => "",
}));

const ADDRESS = "GDVERIFIEDCREATORADDRESS000000000000000000000000000000000";

describe("VerifiedCreatorBadge", () => {
  beforeEach(() => {
    state.verified = false;
    state.attestation = null;
  });

  it("renders nothing when the creator is not verified", () => {
    const { container } = render(<VerifiedCreatorBadge address={ADDRESS} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("exposes a tooltip with the verification date and method via aria-describedby", () => {
    state.verified = true;
    state.attestation = {
      address: ADDRESS,
      signature: "sig",
      timestamp: Date.UTC(2024, 0, 15),
      method: "on-chain proof",
    };

    render(<VerifiedCreatorBadge address={ADDRESS} />);

    const badge = screen.getByText(/Verified Creator/i);
    const tooltip = screen.getByRole("tooltip");

    expect(tooltip).toHaveTextContent(
      "Verified via on-chain proof on January 15, 2024"
    );
    expect(badge).toHaveAttribute("aria-describedby", tooltip.id);
  });

  it("falls back to a generic method when none is recorded", () => {
    state.verified = true;
    state.attestation = {
      address: ADDRESS,
      signature: "sig",
      timestamp: Date.UTC(2024, 5, 1),
    };

    render(<VerifiedCreatorBadge address={ADDRESS} />);

    expect(screen.getByRole("tooltip")).toHaveTextContent(
      "Verified via signed attestation on June 1, 2024"
    );
  });

  it("renders without a tooltip when no verification date is available", () => {
    state.verified = true;
    state.attestation = { address: ADDRESS, signature: "sig" };

    render(<VerifiedCreatorBadge address={ADDRESS} />);

    expect(screen.getByText(/Verified Creator/i)).toBeInTheDocument();
    expect(screen.queryByRole("tooltip")).toBeNull();
    expect(screen.getByText(/Verified Creator/i)).not.toHaveAttribute(
      "aria-describedby"
    );
  });

  it("formats dates in a human-readable form", () => {
    expect(formatVerificationDate(Date.UTC(2024, 0, 15))).toBe("January 15, 2024");
  });
});
