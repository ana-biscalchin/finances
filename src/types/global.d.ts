/// <reference types="node" />

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      NODE_ENV?: string;
      PORT?: string;
      DB_HOST?: string;
      DB_PORT?: string;
      DB_NAME?: string;
      DB_USER?: string;
      DB_PASSWORD?: string;
    }
  }
}

export {}; 