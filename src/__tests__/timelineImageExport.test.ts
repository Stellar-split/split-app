import { getTimelineFilename, getTimelineCaption } from "@/lib/timelineImageExport";

describe("getTimelineFilename", () => {
  it("formats filename with invoice id", () => {
    expect(getTimelineFilename("42")).toBe("invoice-42-timeline.png");
  });

  it("uses the exact id string provided", () => {
    expect(getTimelineFilename("1001")).toBe("invoice-1001-timeline.png");
  });
});

describe("getTimelineCaption", () => {
  it("includes invoice id and status", () => {
    const caption = getTimelineCaption("7", "Released");
    expect(caption).toContain("7");
    expect(caption).toContain("Released");
  });

  it("works for Pending status", () => {
    const caption = getTimelineCaption("3", "Pending");
    expect(caption).toContain("3");
    expect(caption).toContain("Pending");
  });

  it("works for Refunded status", () => {
    const caption = getTimelineCaption("99", "Refunded");
    expect(caption).toContain("99");
    expect(caption).toContain("Refunded");
  });
});
