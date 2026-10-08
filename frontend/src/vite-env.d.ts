/// <reference types="vite/client" />

/** The app version from package.json, injected by Vite's `define`. */
declare const __APP_VERSION__: string

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
