export async function uploadToIPFS(data: any): Promise<string> {
  return 'QmMocked';
}

export async function fetchFromIPFS(cid: string): Promise<any> {
  return {};
}

export const IPFS_GATEWAY = 'https://ipfs.io';

export function getIpfsUrl(cid: string): string {
  return `${IPFS_GATEWAY}/ipfs/${cid}`;
}

export function isValidCid(cid: string): boolean {
  return /^Qm[1-9A-HJ-NP-Za-km-z]{44}$/.test(cid);
}

export async function mockIpfsUpload(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const base32Chars = "abcdefghijklmnopqrstuvwxyz234567";
  let result = "Qm";
  for (let i = 0; i < 44; i++) {
    result += base32Chars[hashArray[i % hashArray.length] % 32];
  }
  return result;
}

export { uploadToIPFS as uploadToIpfs };
