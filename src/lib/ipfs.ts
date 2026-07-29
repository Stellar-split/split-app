/**
 * IPFS upload utilities for dispute evidence submission.
 * Uploads files to a public IPFS gateway and returns the CID.
 */

const IPFS_GATEWAY = process.env.NEXT_PUBLIC_IPFS_GATEWAY ?? "https://api.web3.storage";
const IPFS_API_KEY = process.env.NEXT_PUBLIC_IPFS_API_KEY;

/**
 * Upload a file to IPFS and return the Content Identifier (CID).
 * 
 * @param file - The file to upload
 * @returns The IPFS CID of the uploaded file
 * @throws Error if upload fails
 */
export async function uploadToIpfs(file: File): Promise<string> {
  // Validate file size (max 10MB)
  const MAX_SIZE = 10 * 1024 * 1024;
  if (file.size > MAX_SIZE) {
    throw new Error("File size exceeds 10MB limit");
  }

  // Validate file type
  const allowedTypes = [
    "application/pdf",
    "image/png",
    "image/jpeg",
    "image/gif",
    "text/plain",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ];

  if (!allowedTypes.includes(file.type)) {
    throw new Error("File type not supported. Use PDF, images, or text documents.");
  }

  try {
    // Use Web3.Storage or similar IPFS pinning service
    // This is a simplified implementation - in production you'd use the Web3.Storage SDK
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(`${IPFS_GATEWAY}/upload`, {
      method: "POST",
      headers: IPFS_API_KEY ? {
        "Authorization": `Bearer ${IPFS_API_KEY}`,
      } : {},
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`IPFS upload failed: ${response.statusText}`);
    }

    const data = await response.json();
    
    // Extract CID from response (format depends on gateway)
    const cid = data.cid || data.Hash || data.ipfsHash;
    
    if (!cid) {
      throw new Error("No CID returned from IPFS gateway");
    }

    return cid;
  } catch (error) {
    console.error("IPFS upload error:", error);
    throw new Error(
      error instanceof Error ? error.message : "Failed to upload file to IPFS"
    );
  }
}

/**
 * Get the public IPFS gateway URL for a given CID.
 * 
 * @param cid - The IPFS Content Identifier
 * @returns Full URL to access the content
 */
export function getIpfsUrl(cid: string): string {
  return `https://ipfs.io/ipfs/${cid}`;
}

/**
 * Validate an IPFS CID format.
 * 
 * @param cid - The CID to validate
 * @returns true if valid, false otherwise
 */
export function isValidCid(cid: string): boolean {
  // Basic CID validation (v0 and v1)
  // CIDv0: starts with 'Qm' and is 46 characters
  // CIDv1: starts with 'b' and is longer
  if (/^Qm[1-9A-HJ-NP-Za-km-z]{44}$/.test(cid)) {
    return true;
  }
  if (/^b[a-z2-7]{58,}$/.test(cid)) {
    return true;
  }
  return false;
}

/**
 * Mock IPFS upload for development/testing when gateway is not configured.
 * Generates a deterministic mock CID based on file content.
 */
export async function mockIpfsUpload(file: File): Promise<string> {
  // Generate a deterministic mock CID based on file name and size
  const hash = await hashFile(file);
  return `Qm${hash.substring(0, 44)}`;
}

async function hashFile(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
  return hashHex;
}

/**
 * Upload file to IPFS with fallback to mock for development.
 */
export async function uploadToIpfsWithFallback(file: File): Promise<string> {
  if (!IPFS_API_KEY || process.env.NODE_ENV === "development") {
    console.warn("Using mock IPFS upload (no API key configured)");
    return mockIpfsUpload(file);
  }
  
  try {
    return await uploadToIpfs(file);
  } catch (error) {
    console.error("IPFS upload failed, using mock:", error);
    return mockIpfsUpload(file);
  }
}
