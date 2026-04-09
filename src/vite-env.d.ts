/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 后端静态资源源站（用于拼接 resultUrl 相对路径），默认 http://localhost:8080 */
  readonly VITE_API_ORIGIN?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
