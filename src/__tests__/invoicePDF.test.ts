import { getPDFThemeClasses } from "@/lib/pdfTheme";

describe("getPDFThemeClasses", () => {
  it("print mode returns light classes when resolvedTheme is light", () => {
    const classes = getPDFThemeClasses("print", "light");
    expect(classes.container).toBe("bg-white text-black");
    expect(classes.subtitle).toBe("text-gray-500");
    expect(classes.borderRow).toBe("border-gray-200");
    expect(classes.borderHeaderRow).toBe("border-gray-300");
    expect(classes.recipientRow).toBe("border-gray-100");
    expect(classes.watermark).toBe("text-gray-800");
  });

  it("print mode returns light classes when resolvedTheme is dark", () => {
    const classes = getPDFThemeClasses("print", "dark");
    expect(classes.container).toBe("bg-white text-black");
    expect(classes.subtitle).toBe("text-gray-500");
    expect(classes.borderRow).toBe("border-gray-200");
    expect(classes.borderHeaderRow).toBe("border-gray-300");
    expect(classes.recipientRow).toBe("border-gray-100");
    expect(classes.watermark).toBe("text-gray-800");
  });

  it("screen mode + dark theme returns dark classes", () => {
    const classes = getPDFThemeClasses("screen", "dark");
    expect(classes.container).toBe("bg-gray-900 text-gray-100");
    expect(classes.subtitle).toBe("text-gray-400");
    expect(classes.borderRow).toBe("border-gray-700");
    expect(classes.borderHeaderRow).toBe("border-gray-600");
    expect(classes.recipientRow).toBe("border-gray-800");
    expect(classes.watermark).toBe("text-gray-300");
  });

  it("screen mode + light theme returns light classes", () => {
    const classes = getPDFThemeClasses("screen", "light");
    expect(classes.container).toBe("bg-white text-black");
    expect(classes.subtitle).toBe("text-gray-500");
    expect(classes.borderRow).toBe("border-gray-200");
    expect(classes.borderHeaderRow).toBe("border-gray-300");
    expect(classes.recipientRow).toBe("border-gray-100");
    expect(classes.watermark).toBe("text-gray-800");
  });
});
