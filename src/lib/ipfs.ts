export async function uploadToIPFS(file: File): Promise<string> {
  if (file.size > 10 * 1024 * 1024) {
    throw new Error('File size exceeds 10MB limit');
  }

  const supportedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'application/json', 'text/plain'];
  if (!supportedTypes.includes(file.type)) {
    throw new Error('File type not supported');
  }

  const formData = new FormData();
  formData.append('file', file);

  const apiKey = process.env.NEXT_PUBLIC_IPFS_API_KEY;
  const headers: Record<string, string> = {};
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  let response: Response;
  try {
    response = await fetch(`${process.env.NEXT_PUBLIC_IPFS_URL || 'https://ipfs.io'}/upload`, {
      method: 'POST',
      body: formData,
      headers,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to upload file to IPFS: ${message}`);
  }

  if (!response.ok) {
    throw new Error(`IPFS upload failed with status ${response.status}`);
  }

  const data = await response.json() as { cid?: string };

  if (!data.cid) {
    throw new Error('No CID returned from IPFS gateway');
  }

  return data.cid;
}

export async function fetchFromIPFS(cid: string): Promise<any> {
  const response = await fetch(`${IPFS_GATEWAY}/ipfs/${cid}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch from IPFS: ${response.statusText}`);
  }
  return response.json();
}

export const IPFS_GATEWAY = 'https://ipfs.io';

export function getIpfsUrl(cid: string): string {
  return `${IPFS_GATEWAY}/ipfs/${cid}`;
}

export function isValidCid(cid: string): boolean {
  if (!cid || typeof cid !== 'string') return false;
  // CIDv0: starts with Qm followed by 44 valid base58 characters
  if (/^Qm[1-9A-HJ-NP-Za-km-z]{44}$/.test(cid)) return true;
  // CIDv1: starts with bafy (base32) or bz (base58btc) and is 59+ chars
  if (/^bafy[a-z2-7]{55,}$/.test(cid)) return true;
  return false;
}

export async function mockIpfsUpload(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const base58Chars = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let result = "Qm";
  for (let i = 0; i < 44; i++) {
    result += base58Chars[hashArray[i % hashArray.length] % 58];
  }
  return result;
}

export { uploadToIPFS as uploadToIpfs };
