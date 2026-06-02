/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_GROCY_DESPENSA_GROUP_ID?: string
  readonly VITE_GROCY_DEFAULT_LOCATION_ID?: string
  readonly VITE_GROCY_DEFAULT_QU_ID?: string
  readonly VITE_OPENROUTER_TEXT_MODEL?: string
  readonly VITE_OPENROUTER_VISION_MODEL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
