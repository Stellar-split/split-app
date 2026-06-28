/**
 * Unit tests for @mention parsing, chip rendering, self-mention suppression,
 * and malformed pattern handling in CommentSection / notifications.
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import { parseMentions, notifyMention } from "@/lib/notifications";
import { renderCommentText } from "@/components/CommentSection";

// ---------------------------------------------------------------------------
// Valid 56-char Stellar addresses (G + 55 uppercase alphanumeric chars).
// ---------------------------------------------------------------------------
const ADDR_A = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN1";
const ADDR_B = "GBVVJJFUR2ZIQFGKGP7BVLPGW3ZVEZG2BGCJM6LAQZWBPKWU3S2WBXM2";
const SELF   = "GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGMXQBIDTJYKDJSWPBHSTHL";

// ---------------------------------------------------------------------------
// parseMentions
// ---------------------------------------------------------------------------

describe("parseMentions", () => {
  test("returns empty array for text with no mentions", () => {
    expect(parseMentions("no mentions here")).toEqual([]);
  });

  test("extracts a single valid address", () => {
    expect(parseMentions(`Hey @${ADDR_A} check this out`)).toEqual([ADDR_A]);
  });

  test("extracts multiple distinct addresses", () => {
    const result = parseMentions(`@${ADDR_A} and @${ADDR_B}`);
    expect(result).toEqual(expect.arrayContaining([ADDR_A, ADDR_B]));
    expect(result).toHaveLength(2);
  });

  test("deduplicates repeated mentions of the same address", () => {
    expect(parseMentions(`@${ADDR_A} again @${ADDR_A}`)).toEqual([ADDR_A]);
  });

  test("ignores malformed @G patterns shorter than 56 chars", () => {
    expect(parseMentions("@GABC123 is not valid")).toEqual([]);
  });

  test("ignores @G patterns longer than 56 chars", () => {
    const tooLong = "G" + "A".repeat(56); // 57 chars total
    expect(parseMentions(`@${tooLong}`)).toEqual([]);
  });

  test("ignores lowercase g-prefix patterns", () => {
    const lower = "g" + "a".repeat(55);
    expect(parseMentions(`@${lower}`)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// renderCommentText
// ---------------------------------------------------------------------------

describe("renderCommentText", () => {
  test("renders plain text when no mentions are present", () => {
    const { container } = render(<>{renderCommentText("hello world")}</>);
    expect(container.textContent).toBe("hello world");
    expect(container.querySelector("span[aria-label]")).toBeNull();
  });

  test("renders a chip for a valid address mention", () => {
    render(<>{renderCommentText(`Pay @${ADDR_A} please`)}</>);
    const chip = screen.getByLabelText(`Mentioned address ${ADDR_A}`);
    expect(chip).toBeInTheDocument();
    // Chip shows truncated form, not full raw address
    expect(chip.textContent).toMatch(/^@/);
    expect(chip.textContent).not.toBe(`@${ADDR_A}`);
  });

  test("renders chips for each valid address in multi-mention text", () => {
    render(<>{renderCommentText(`@${ADDR_A} and @${ADDR_B}`)}</>);
    expect(screen.getByLabelText(`Mentioned address ${ADDR_A}`)).toBeInTheDocument();
    expect(screen.getByLabelText(`Mentioned address ${ADDR_B}`)).toBeInTheDocument();
  });

  test("malformed @G pattern renders as plain text, not a chip", () => {
    const { container } = render(<>{renderCommentText("@GBADADDRESS is wrong")}</>);
    expect(container.textContent).toContain("@GBADADDRESS");
    expect(container.querySelector("span[aria-label]")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// notifyMention — test via Notification constructor spy
// ---------------------------------------------------------------------------

describe("notifyMention", () => {
  let NotificationSpy: jest.Mock;

  beforeEach(() => {
    NotificationSpy = jest.fn();
    NotificationSpy.permission = "granted" as NotificationPermission;
    Object.defineProperty(global, "Notification", {
      writable: true,
      configurable: true,
      value: NotificationSpy,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("does NOT notify when mentionedAddress === commenterAddress (self-mention)", () => {
    notifyMention(SELF, SELF, "INV-1");
    expect(NotificationSpy).not.toHaveBeenCalled();
  });

  test("fires a Notification when mentionedAddress differs from commenter", () => {
    notifyMention(ADDR_A, ADDR_B, "INV-1");
    expect(NotificationSpy).toHaveBeenCalledTimes(1);
    const [title, opts] = NotificationSpy.mock.calls[0];
    expect(title).toContain("INV-1");
    expect(opts.tag).toContain(ADDR_A);
  });
});
