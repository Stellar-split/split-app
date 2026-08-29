import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { uploadToIpfs, getIpfsUrl, isValidCid, mockIpfsUpload } from "../ipfs";

global.fetch = vi.fn();
vi.stubGlobal("crypto", { subtle: { digest: vi.fn() } });

describe("IPFS utilities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("uploadToIpfs", () => {
    it("uploads file and returns CID", async () => {
      const mockCid = "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG";
      
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ cid: mockCid }),
      });

      const file = new File(["test content"], "test.pdf", {
        type: "application/pdf",
      });

      const result = await uploadToIpfs(file);

      expect(result).toBe(mockCid);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/upload"),
        expect.objectContaining({
          method: "POST",
        })
      );
    });

    it("throws error for files exceeding size limit", async () => {
      // Create a file larger than 10MB
      const largeContent = "x".repeat(11 * 1024 * 1024);
      const largeFile = new File([largeContent], "large.pdf", {
        type: "application/pdf",
      });

      await expect(uploadToIpfs(largeFile)).rejects.toThrow("File size exceeds 10MB limit");
    });

    it("throws error for unsupported file types", async () => {
      const file = new File(["content"], "test.exe", {
        type: "application/x-msdownload",
      });

      await expect(uploadToIpfs(file)).rejects.toThrow("File type not supported");
    });

    it("accepts PDF files", async () => {
      const mockCid = "QmTest123";
      
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ cid: mockCid }),
      });

      const file = new File(["content"], "doc.pdf", {
        type: "application/pdf",
      });

      const result = await uploadToIpfs(file);
      expect(result).toBe(mockCid);
    });

    it("accepts image files", async () => {
      const mockCid = "QmTest456";
      
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ cid: mockCid }),
      });

      const file = new File(["content"], "image.png", {
        type: "image/png",
      });

      const result = await uploadToIpfs(file);
      expect(result).toBe(mockCid);
    });

    it("accepts text files", async () => {
      const mockCid = "QmTest789";
      
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ cid: mockCid }),
      });

      const file = new File(["content"], "notes.txt", {
        type: "text/plain",
      });

      const result = await uploadToIpfs(file);
      expect(result).toBe(mockCid);
    });

    it("handles API errors gracefully", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        statusText: "Internal Server Error",
      });

      const file = new File(["content"], "test.pdf", {
        type: "application/pdf",
      });

      await expect(uploadToIpfs(file)).rejects.toThrow("IPFS upload failed");
    });

    it("handles network errors", async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error("Network error"));

      const file = new File(["content"], "test.pdf", {
        type: "application/pdf",
      });

      await expect(uploadToIpfs(file)).rejects.toThrow("Failed to upload file to IPFS");
    });

    it("throws error when no CID is returned", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}), // No CID in response
      });

      const file = new File(["content"], "test.pdf", {
        type: "application/pdf",
      });

      await expect(uploadToIpfs(file)).rejects.toThrow("No CID returned from IPFS gateway");
    });

    it("includes API key in request when configured", async () => {
      const originalEnv = process.env.NEXT_PUBLIC_IPFS_API_KEY;
      process.env.NEXT_PUBLIC_IPFS_API_KEY = "test-api-key";

      const mockCid = "QmTest123";
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ cid: mockCid }),
      });

      const file = new File(["content"], "test.pdf", {
        type: "application/pdf",
      });

      await uploadToIpfs(file);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer test-api-key",
          }),
        })
      );

      process.env.NEXT_PUBLIC_IPFS_API_KEY = originalEnv;
    });
  });

  describe("getIpfsUrl", () => {
    it("returns correct IPFS gateway URL", () => {
      const cid = "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG";
      const url = getIpfsUrl(cid);
      
      expect(url).toBe(`https://ipfs.io/ipfs/${cid}`);
    });

    it("handles different CID formats", () => {
      const cidV0 = "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG";
      const cidV1 = "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi";

      expect(getIpfsUrl(cidV0)).toContain(cidV0);
      expect(getIpfsUrl(cidV1)).toContain(cidV1);
    });
  });

  describe("isValidCid", () => {
    it("validates CIDv0 format", () => {
      const validCidV0 = "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG";
      expect(isValidCid(validCidV0)).toBe(true);
    });

    it("validates CIDv1 format", () => {
      const validCidV1 = "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi";
      expect(isValidCid(validCidV1)).toBe(true);
    });

    it("rejects invalid CID formats", () => {
      expect(isValidCid("invalid-cid")).toBe(false);
      expect(isValidCid("Qm123")).toBe(false); // Too short
      expect(isValidCid("")).toBe(false);
      expect(isValidCid("not-a-cid-at-all")).toBe(false);
    });

    it("rejects CIDv0 with wrong length", () => {
      expect(isValidCid("QmTooShort")).toBe(false);
      expect(isValidCid("Qm" + "a".repeat(50))).toBe(false); // Too long
    });

    it("rejects CIDv1 with wrong prefix", () => {
      expect(isValidCid("a" + "a".repeat(58))).toBe(false);
      expect(isValidCid("c" + "a".repeat(58))).toBe(false);
    });
  });

  describe("mockIpfsUpload", () => {
    beforeEach(() => {
      // Mock crypto.subtle.digest
      (global.crypto.subtle.digest as any).mockResolvedValue(
        new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]).buffer
      );
    });

    it("generates deterministic CID for same file", async () => {
      const file1 = new File(["test content"], "test.pdf", {
        type: "application/pdf",
      });
      const file2 = new File(["test content"], "test.pdf", {
        type: "application/pdf",
      });

      const cid1 = await mockIpfsUpload(file1);
      const cid2 = await mockIpfsUpload(file2);

      expect(cid1).toBe(cid2);
      expect(cid1).toMatch(/^Qm[1-9A-HJ-NP-Za-km-z]{44}$/);
    });

    it("generates different CIDs for different files", async () => {
      // Mock different hash outputs
      (global.crypto.subtle.digest as any)
        .mockResolvedValueOnce(new Uint8Array(16).fill(1).buffer)
        .mockResolvedValueOnce(new Uint8Array(16).fill(2).buffer);

      const file1 = new File(["content1"], "file1.pdf", {
        type: "application/pdf",
      });
      const file2 = new File(["content2"], "file2.pdf", {
        type: "application/pdf",
      });

      const cid1 = await mockIpfsUpload(file1);
      const cid2 = await mockIpfsUpload(file2);

      expect(cid1).not.toBe(cid2);
    });

    it("returns valid CIDv0 format", async () => {
      const file = new File(["content"], "test.pdf", {
        type: "application/pdf",
      });

      const cid = await mockIpfsUpload(file);

      expect(isValidCid(cid)).toBe(true);
      expect(cid.startsWith("Qm")).toBe(true);
      expect(cid.length).toBe(46);
    });
  });
});
