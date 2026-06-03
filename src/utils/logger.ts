type LogArgs = unknown[];

function debugLoggingEnabled(): boolean {
  if (import.meta.env.DEV || import.meta.env.MODE === 'test') {
    return true;
  }

  try {
    return localStorage.getItem('noder:debugLogs') === 'true';
  } catch {
    return false;
  }
}

export const logger = {
  debug: (...args: LogArgs): void => {
    if (debugLoggingEnabled()) {
      console.log(...args);
    }
  },

  info: (...args: LogArgs): void => {
    if (debugLoggingEnabled()) {
      console.info(...args);
    }
  },

  warn: (...args: LogArgs): void => {
    console.warn(...args);
  },

  error: (...args: LogArgs): void => {
    console.error(...args);
  },
};
