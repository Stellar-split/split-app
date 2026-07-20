import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { generateCsv, type CsvRow } from "@/lib/csvExport";

describe("generateCsv", () => {
  let clickSpy: ReturnType<typeof vi.fn>;
  let appendChildSpy: ReturnType<typeof vi.fn>;
  let removeChildSpy: ReturnType<typeof vi.fn>;
  let revokeObjectURLSpy: ReturnType<typeof vi.fn>;
  let createObjectURLSpy: ReturnType<typeof vi.fn>;
  let linkAttrs: Record<string, string>;

  beforeEach(() => {
    clickSpy = vi.fn();
    appendChildSpy = vi.fn();
    removeChildSpy = vi.fn();
    revokeObjectURLSpy = vi.fn();
    createObjectURLSpy = vi.fn(() => "blob:mock-url");
    linkAttrs = {};

    const mockLink = {
      click: clickSpy,
      setAttribute: (name: string, value: string) => {
        linkAttrs[name] = value;
      },
      style: { display: "" },
    };

    vi.spyOn(document, "createElement").mockReturnValue(mockLink as unknown as HTMLElement);
    vi.spyOn(document.body, "appendChild").mockImplementation(appendChildSpy);
    vi.spyOn(document.body, "removeChild").mockImplementation(removeChildSpy);
    vi.spyOn(URL, "createObjectURL").mockImplementation(createObjectURLSpy);
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(revokeObjectURLSpy);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does nothing when rows are empty", () => {
    generateCsv([], "test");
    expect(appendChildSpy).not.toHaveBeenCalled();
  });

  it("creates and clicks a download link", () => {
    const rows: CsvRow[] = [
      { id: "1", status: "Released", amount: 100 },
      { id: "2", status: "Pending", amount: 50 },
    ];
    generateCsv(rows, "my-data");

    expect(createObjectURLSpy).toHaveBeenCalled();
    expect(appendChildSpy).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    expect(removeChildSpy).toHaveBeenCalled();
    expect(revokeObjectURLSpy).toHaveBeenCalled();
    expect(linkAttrs["download"]).toBe("my-data.csv");
  });

  it("generates a Blob with CSV content", () => {
    const rows: CsvRow[] = [{ id: "1", name: "Test" }];
    generateCsv(rows, "test");

    const blobArg = createObjectURLSpy.mock.calls[0][0] as Blob;
    expect(blobArg).toBeInstanceOf(Blob);
  });

  it("handles values with commas by quoting them", () => {
    const rows: CsvRow[] = [{ id: "1", note: "hello, world" }];
    generateCsv(rows, "test");
    expect(createObjectURLSpy).toHaveBeenCalled();
  });

  it("handles values with double quotes by escaping them", () => {
    const rows: CsvRow[] = [{ id: "1", note: 'say "hi"' }];
    generateCsv(rows, "test");
    expect(createObjectURLSpy).toHaveBeenCalled();
  });
});
