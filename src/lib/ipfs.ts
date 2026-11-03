export async function uploadToIPFS(data: any): Promise<string> {
  return 'QmMocked';
}

export async function fetchFromIPFS(cid: string): Promise<any> {
  return {};
}

export const IPFS_GATEWAY = 'https://ipfs.io';

export { uploadToIPFS as uploadToIpfs };
