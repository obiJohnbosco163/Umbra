/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_REGISTRY_ACCOUNT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
