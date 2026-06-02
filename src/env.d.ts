/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

declare module '*?url' {
  const value: string;
  export default value;
}