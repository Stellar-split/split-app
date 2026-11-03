export const apiClient = {
  get: async (url: string) => ({ ok: true, status: 200 }),
  post: async (url: string, data: any) => ({ ok: true, status: 200 }),
  delete: async (url: string) => ({ ok: true, status: 200 }),
  put: async (url: string, data: any) => ({ ok: true, status: 200 }),
  patch: async (url: string, data: any) => ({ ok: true, status: 200 }),
};

export async function apiFetch(url: string, options?: any): Promise<any> {
  return {};
}
