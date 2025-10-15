/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly GENERATE_SOURCEMAP: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module "*.svg" {
  import * as React from "react";
  export const ReactComponent: React.FunctionComponent<
    React.SVGProps<SVGSVGElement>
  >;
  const src: string;
  export default src;
}

declare module "*.ogg" {
  const src: string;
  export default src;
}