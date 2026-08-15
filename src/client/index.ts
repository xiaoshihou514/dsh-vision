/** Browser half: vision settings; image intake is owned by the native composer. @module dsh-vision/client */

import type {} from "@deepseek-ai/dsh-client-ui-slots";
import type {} from "@deepseek-ai/dsh-client-ui-settings-plugins/client";
import type { ClientContext } from "@deepseek-ai/dsh-client-runtime/client";
import type { IApiClient } from "@deepseek-ai/dsh-client-connection/client";
import { VisionSettingsCard } from "./VisionSettingsCard.tsx";
import type { VisionSettingsCardInjected } from "./VisionSettingsCard.tsx";
import { VisionSettingsScope } from "./vision-settings.ts";

/** Required services (fiber inject). */
export const inject = ["connection", "slots"];

/**
 * Mount plugin settings. The Harness composer already owns native image
 * selection, previews, paste, drag/drop, and attachment submission.
 * @param ctx - the browser plugin context.
 */
export function apply(ctx: ClientContext): void {
  const { api } = ctx.get("connection") as { api: IApiClient };
  const settings = new VisionSettingsScope();
  ctx.slots.inject("settings.plugin.item", function* () {
    yield ctx.slots.register(
      {
        name: "settings.plugin.item",
        id: "dsh-vision",
        order: 25,
        inject: (): VisionSettingsCardInjected => ({ scope: settings, api }),
      },
      VisionSettingsCard,
    );
  });
}
