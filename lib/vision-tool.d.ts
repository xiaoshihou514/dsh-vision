import ToolRuntime from "@deepseek-ai/dsh-tools";
import { Context } from "@deepseek-ai/cordis";
import SystemPrompt from "@deepseek-ai/dsh-system-prompt";
//#region src/vision-tool.d.ts
type ToolContext = Context & {
  tools: ToolRuntime;
  systemPrompt: SystemPrompt;
};
declare const name = "vision-tool";
declare const inject: string[];
declare function apply(ctx: ToolContext): void;
//#endregion
export { apply, inject, name };