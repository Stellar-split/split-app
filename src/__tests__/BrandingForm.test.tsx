import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import BrandingForm from "@/components/settings/BrandingForm";
import {
  LOGO_SIZE_ERROR,
  LOGO_TYPE_ERROR,
  MAX_LOGO_BYTES,
} from "@/lib/brandSettings";

const ADDRESS = "GBRPYHIL2CI3WHZDTOOQFC6EB4WXONTZJ3TXFLQ5XJJIJF4OJZC6J65A";

const mockUploadBrandLogo = vi.fn();
const mockSaveBrandSettingsRemote = vi.fn();
const mockClearBrandSettingsRemote = vi.fn();
const mockFetchBrandSettings = vi.fn();

vi.mock("@/lib/freighter", () => ({
  getFreighterPublicKey: vi.fn().mockResolvedValue(
    "GBRPYHIL2CI3WHZDTOOQFC6EB4WXONTZJ3TXFLQ5XJJIJF4OJZC6J65A",
  ),
}));

vi.mock("@/lib/branding", () => ({
  fetchBrandSettings: (...args: unknown[]) => mockFetchBrandSettings(...args),
  saveBrandSettingsRemote: (...args: unknown[]) => mockSaveBrandSettingsRemote(...args),
  clearBrandSettingsRemote: (...args: unknown[]) => mockClearBrandSettingsRemote(...args),
  uploadBrandLogo: (...args: unknown[]) => mockUploadBrandLogo(...args),
}));

/** Render the form and wait for the wallet load + settings fetch to settle. */
async function renderLoadedForm() {
  render(<BrandingForm />);
  return screen.findByLabelText("Accent color hex value");
}

describe("BrandingForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchBrandSettings.mockResolvedValue({
      logoUrl: null,
      accentColor: null,
      tagline: null,
      updatedAt: "",
    });
    mockUploadBrandLogo.mockResolvedValue({
      logoUrl: "/api/settings/branding/logo/branding/X/logo-1.png",
      width: 800,
      height: 200,
      warning: null,
      cdn: false,
    });
    mockSaveBrandSettingsRemote.mockResolvedValue({
      logoUrl: null,
      accentColor: "#4f46e5",
      tagline: "Fast splits",
      updatedAt: "2026-07-28T00:00:00.000Z",
    });
  });

  it("loads existing branding into the form for the connected account", async () => {
    mockFetchBrandSettings.mockResolvedValue({
      logoUrl: "https://cdn.example.com/logo.png",
      accentColor: "#4f46e5",
      tagline: "Existing tagline",
      updatedAt: "2026-07-01T00:00:00.000Z",
    });

    await renderLoadedForm();

    expect(mockFetchBrandSettings).toHaveBeenCalledWith(ADDRESS);
    expect(screen.getByLabelText("Accent color hex value")).toHaveValue("#4f46e5");
    expect(screen.getByLabelText("Invoice tagline")).toHaveValue("Existing tagline");
    expect(screen.getByAltText("Your logo")).toHaveAttribute("src", "https://cdn.example.com/logo.png");
  });

  it("rejects an unsupported file type with a specific error BEFORE any upload request", async () => {
    await renderLoadedForm();

    const input = screen.getByLabelText(/upload logo/i);
    const gif = new File([new Uint8Array(16)], "logo.gif", { type: "image/gif" });
    fireEvent.change(input, { target: { files: [gif] } });

    expect(await screen.findByText(LOGO_TYPE_ERROR)).toBeInTheDocument();
    expect(mockUploadBrandLogo).not.toHaveBeenCalled();
  });

  it("rejects a file over 2 MB with a specific error BEFORE any upload request", async () => {
    await renderLoadedForm();

    const input = screen.getByLabelText(/upload logo/i);
    const huge = new File([new Uint8Array(MAX_LOGO_BYTES + 1)], "logo.png", { type: "image/png" });
    fireEvent.change(input, { target: { files: [huge] } });

    expect(await screen.findByText(LOGO_SIZE_ERROR)).toBeInTheDocument();
    expect(mockUploadBrandLogo).not.toHaveBeenCalled();
  });

  it("uploads a valid PNG and previews the returned CDN URL", async () => {
    await renderLoadedForm();

    const input = screen.getByLabelText(/upload logo/i);
    const png = new File([new Uint8Array(64)], "logo.png", { type: "image/png" });
    fireEvent.change(input, { target: { files: [png] } });

    await waitFor(() => expect(mockUploadBrandLogo).toHaveBeenCalledTimes(1));
    expect(mockUploadBrandLogo).toHaveBeenCalledWith(ADDRESS, png);
    const previews = await screen.findAllByAltText(/logo/i);
    expect(previews.some((img) => img.getAttribute("src")?.includes("/api/settings/branding/logo/"))).toBe(true);
  });

  it("flags a low-contrast accent color with an inline WCAG warning in real time", async () => {
    await renderLoadedForm();

    fireEvent.change(screen.getByLabelText("Accent color hex value"), {
      target: { value: "#ffffff" },
    });

    const warning = await screen.findByText(/fails WCAG AA contrast against white/i);
    expect(warning).toBeInTheDocument();
  });

  it("blocks saving when the accent color fails WCAG AA (zod validation)", async () => {
    await renderLoadedForm();

    fireEvent.change(screen.getByLabelText("Accent color hex value"), {
      target: { value: "#ffffff" },
    });
    fireEvent.click(screen.getByRole("button", { name: /save branding/i }));

    // Give the async zod resolver a chance to (incorrectly) pass — it must not.
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(mockSaveBrandSettingsRemote).not.toHaveBeenCalled();
    expect(screen.queryByText(/branding saved/i)).not.toBeInTheDocument();
  });

  it("saves accent color and tagline for the connected account", async () => {
    await renderLoadedForm();

    fireEvent.change(screen.getByLabelText("Accent color hex value"), {
      target: { value: "#4f46e5" },
    });
    fireEvent.change(screen.getByLabelText("Invoice tagline"), {
      target: { value: "Fast splits" },
    });
    fireEvent.click(screen.getByRole("button", { name: /save branding/i }));

    await waitFor(() => expect(mockSaveBrandSettingsRemote).toHaveBeenCalledTimes(1));
    const [addressArg, settingsArg] = mockSaveBrandSettingsRemote.mock.calls[0];
    expect(addressArg).toBe(ADDRESS);
    expect(settingsArg).toMatchObject({ accentColor: "#4f46e5", tagline: "Fast splits" });
    expect(await screen.findByText(/branding saved/i)).toBeInTheDocument();
  });

  it("updates the live invoice preview as the accent color changes", async () => {
    await renderLoadedForm();

    const heading = screen.getByText("Invoice", { selector: "p" });
    expect(heading).toHaveStyle({ color: "#4f46e5" }); // platform default

    fireEvent.change(screen.getByLabelText("Accent color hex value"), {
      target: { value: "#047857" },
    });

    await waitFor(() => expect(heading).toHaveStyle({ color: "#047857" }));
  });

  it("removes branding and reverts to platform defaults", async () => {
    await renderLoadedForm();

    fireEvent.change(screen.getByLabelText("Invoice tagline"), { target: { value: "Hello" } });
    fireEvent.click(screen.getByRole("button", { name: /remove branding/i }));

    await waitFor(() => expect(mockClearBrandSettingsRemote).toHaveBeenCalledWith(ADDRESS));
    expect(await screen.findByText(/revert to platform-default styling/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Invoice tagline")).toHaveValue("");
  });
});
