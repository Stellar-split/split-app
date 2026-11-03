export function useToast() {
  return {
    success: (message: string) => {},
    error: (message: string) => {},
    info: (message: string) => {},
  };
}
