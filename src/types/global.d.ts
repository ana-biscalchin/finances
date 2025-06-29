/// <reference types="node" />

// Global types for Node.js environment

declare const process: {
  env: {
    NODE_ENV?: string;
    PORT?: string;
    DB_HOST?: string;
    DB_PORT?: string;
    DB_NAME?: string;
    DB_USER?: string;
    DB_PASSWORD?: string;
    [key: string]: string | undefined;
  };
  exit: (code?: number) => never;
};

declare const console: {
  log: (...args: any[]) => void;
  error: (...args: any[]) => void;
  warn: (...args: any[]) => void;
  info: (...args: any[]) => void;
};

declare const __dirname: string;
declare const __filename: string;

declare module 'fs' {
  export function readFileSync(path: string, encoding?: string): string | Buffer;
  export function readdirSync(path: string): string[];
  // Add other fs functions as needed
}

declare module 'path' {
  export function join(...paths: string[]): string;
  export function resolve(...paths: string[]): string;
  // Add other path functions as needed
}

export {}; 