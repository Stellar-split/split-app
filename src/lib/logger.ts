export const logger = {
  error: (message: string, context?: any) => {
    console.error(message, context);
  },
  warn: (message: string, context?: any) => {
    console.warn(message, context);
  },
  info: (message: string, context?: any) => {
    console.info(message, context);
  },
  debug: (message: string, context?: any) => {
    console.debug(message, context);
  },
};
