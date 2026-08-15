import { Context } from "@deepseek-ai/cordis";
import { IncomingMessage, ServerResponse } from "node:http";
//#region src/settings-api.d.ts
interface WebRouteShape {
  kind: "exact" | "prefix";
  path: string;
  handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>;
}
declare module "@deepseek-ai/cordis" {
  interface Context {
    webServer: {
      register(route: WebRouteShape): () => void;
    };
  }
}
declare const name = "vision-settings-api";
declare const inject: string[];
declare function apply(ctx: Context): void;
//#endregion
export { WebRouteShape, apply, inject, name };