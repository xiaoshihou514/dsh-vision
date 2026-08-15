window.__ModuleLoader__.load({
  id: "dsh-vision",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
    let react = require("react");
    let react_jsx_runtime = require("react/jsx-runtime");
    //#region src/client/VisionSettingsCard.tsx
    /** Settings -> Plugins card for the host-side dsh-vision settings section. */
    const card = {
      listStyle: "none",
      border: "1px solid var(--dsw-alias-border-l2)",
      borderRadius: 12,
      background: "var(--dsw-alias-bg-layer-3)",
    };
    const header = {
      width: "100%",
      appearance: "none",
      border: 0,
      background: "transparent",
      borderRadius: 12,
      color: "inherit",
      font: "inherit",
      textAlign: "left",
      cursor: "pointer",
      padding: "14px 16px",
      display: "flex",
      alignItems: "center",
      gap: 12,
    };
    const field = {
      display: "grid",
      gap: 5,
      marginTop: 12,
    };
    const input = {
      width: "100%",
      boxSizing: "border-box",
      border: "1px solid var(--dsw-alias-border-l2)",
      borderRadius: 8,
      padding: "7px 9px",
      font: "inherit",
      color: "inherit",
      background: "var(--dsw-alias-bg-layer-3)",
    };
    const primary = {
      appearance: "none",
      border: 0,
      borderRadius: 8,
      padding: "6px 14px",
      font: "inherit",
      cursor: "pointer",
      color: "var(--dsw-alias-bg-layer-3)",
      background: "var(--dsw-alias-label-primary)",
    };
    const secondary = {
      appearance: "none",
      border: "1px solid var(--dsw-alias-border-l2)",
      borderRadius: 8,
      padding: "5px 14px",
      font: "inherit",
      fontSize: 13,
      lineHeight: 1.5,
      cursor: "pointer",
      color: "var(--dsw-alias-label-primary)",
      background: "transparent",
    };
    function text(value) {
      return typeof value === "string" || typeof value === "number"
        ? String(value)
        : "";
    }
    function Field(props) {
      return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
        style: field,
        children: [
          /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
            style: {
              fontSize: 13,
              fontWeight: 500,
            },
            children: props.label,
          }),
          /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
            style: input,
            type: props.type ?? "text",
            value: props.value,
            disabled: props.disabled,
            autoComplete: props.type === "password" ? "off" : void 0,
            onChange: (event) => {
              props.onChange(event.target.value);
            },
          }),
        ],
      });
    }
    /** Editable vision backend card contributed to the native plugin configuration slot. */
    function VisionSettingsCard({ scope, api }) {
      const snapshot = (0, react.useSyncExternalStore)(
        (listener) => scope.subscribe(listener),
        () => scope.getSnapshot(),
      );
      const [open, setOpen] = (0, react.useState)(false);
      const [draft, setDraft] = (0, react.useState)({});
      const [apiKey, setApiKey] = (0, react.useState)("");
      const [keyConfigured, setKeyConfigured] = (0, react.useState)();
      const [saving, setSaving] = (0, react.useState)(false);
      const [error, setError] = (0, react.useState)(null);
      (0, react.useEffect)(() => {
        let stale = false;
        api.credentials.describe({ refs: ["ZHIPUAI_API_KEY"] }).then(
          (response) => {
            if (stale || !response.result.ok) return;
            setKeyConfigured(
              response.result.value.credentials.ZHIPUAI_API_KEY?.configured ??
                false,
            );
          },
          () => void 0,
        );
        return () => {
          stale = true;
        };
      }, [api.credentials]);
      const value = snapshot.value ?? {};
      const read = (name) => draft[name] ?? text(value[name]);
      const edit = (name, next) => {
        setDraft((current) => ({
          ...current,
          [name]: next,
        }));
        setError(null);
      };
      const backend = read("backend") === "qwen" ? "qwen" : "glm";
      const disabled =
        snapshot.status !== "ready" || !snapshot.writable || saving;
      const save = async () => {
        if (disabled) return;
        setSaving(true);
        setError(null);
        try {
          for (const [name, raw] of Object.entries(draft)) {
            const trimmed = raw.trim();
            if (trimmed === "") await scope.unset(name);
            else await scope.set(name, trimmed);
          }
          if (apiKey.trim() !== "") {
            const response = await api.credentials.set({
              ref: "ZHIPUAI_API_KEY",
              value: apiKey.trim(),
            });
            if (!response.result.ok)
              throw new Error(response.result.error.message);
            setKeyConfigured(true);
          }
          setDraft({});
          setApiKey("");
        } catch (caught) {
          setError(caught instanceof Error ? caught.message : String(caught));
        } finally {
          setSaving(false);
        }
      };
      return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
        style: card,
        children: [
          /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
            type: "button",
            style: header,
            "aria-expanded": open,
            "aria-label": `${open ? "收起" : "展开"}：视觉识别`,
            onClick: () => {
              setOpen(!open);
            },
            children: [
              /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
                style: {
                  display: "grid",
                  gap: 4,
                  flex: 1,
                  minWidth: 0,
                },
                children: [
                  /* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", {
                    style: { fontSize: 15 },
                    children: "视觉识别",
                  }),
                  /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
                    style: {
                      color: "var(--dsw-alias-label-tertiary)",
                      fontSize: 13,
                    },
                    children: "配置 GLM 云端识图或本地 Qwen3-VL",
                  }),
                ],
              }),
              /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
                width: "14",
                height: "14",
                viewBox: "0 0 14 14",
                fill: "none",
                "aria-hidden": "true",
                style: {
                  color: "var(--dsw-alias-label-tertiary)",
                  flex: "none",
                  transform: open ? "rotate(180deg)" : void 0,
                  transition: "transform .16s",
                },
                children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
                  d: "M11.8486 5.5L11.4238 5.92383L8.69727 8.65137C8.44157 8.90706 8.21562 9.13382 8.01172 9.29785C7.79912 9.46883 7.55595 9.61756 7.25 9.66602C7.08435 9.69222 6.91565 9.69222 6.75 9.66602C6.44405 9.61756 6.20088 9.46883 5.98828 9.29785C5.78438 9.13382 5.55843 8.90706 5.30273 8.65137L2.57617 5.92383L2.15137 5.5L3 4.65137L3.42383 5.07617L6.15137 7.80273C6.42595 8.07732 6.59876 8.24849 6.74023 8.3623C6.87291 8.46904 6.92272 8.47813 6.9375 8.48047C6.97895 8.48703 7.02105 8.48703 7.0625 8.48047C7.07728 8.47813 7.12709 8.46904 7.25977 8.3623C7.40124 8.24849 7.57405 8.07732 7.84863 7.80273L10.5762 5.07617L11 4.65137L11.8486 5.5Z",
                  fill: "currentColor",
                }),
              }),
            ],
          }),
          open
            ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
                style: {
                  borderTop: "1px solid var(--dsw-alias-border-l2)",
                  margin: "0 16px",
                  padding: "2px 0 12px",
                },
                children: [
                  snapshot.status === "unavailable"
                    ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
                        role: "status",
                        style: {
                          color: "var(--dsw-alias-label-error)",
                          fontSize: 12,
                        },
                        children:
                          "设置服务不可用，请检查 dsh-vision 是否完整加载。",
                      })
                    : null,
                  /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
                    style: field,
                    children: [
                      /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
                        style: {
                          fontSize: 13,
                          fontWeight: 500,
                        },
                        children: "识图后端",
                      }),
                      /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
                        style: input,
                        value: backend,
                        disabled,
                        onChange: (event) => {
                          edit("backend", event.target.value);
                        },
                        children: [
                          /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
                            value: "glm",
                            children: "GLM 云端",
                          }),
                          /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
                            value: "qwen",
                            children: "Qwen3-VL 本地",
                          }),
                        ],
                      }),
                    ],
                  }),
                  backend === "glm"
                    ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(
                        react_jsx_runtime.Fragment,
                        {
                          children: [
                            /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
                              style: { position: "relative" },
                              children: [
                                /* @__PURE__ */ (0, react_jsx_runtime.jsx)(
                                  Field,
                                  {
                                    label: "API Key（仅写入凭据存储）",
                                    type: "password",
                                    value: apiKey,
                                    disabled,
                                    onChange: setApiKey,
                                  },
                                ),
                                keyConfigured !== void 0
                                  ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(
                                      "span",
                                      {
                                        role: "status",
                                        style: {
                                          position: "absolute",
                                          right: 0,
                                          top: 12,
                                          color: keyConfigured
                                            ? "var(--dsw-alias-label-primary)"
                                            : "var(--dsw-alias-label-tertiary)",
                                          fontSize: 12,
                                        },
                                        children: keyConfigured
                                          ? "已配置"
                                          : "未配置",
                                      },
                                    )
                                  : null,
                              ],
                            }),
                            /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
                              style: {
                                margin: "8px 0 0",
                                color: "var(--dsw-alias-label-tertiary)",
                                fontSize: 12,
                              },
                              children: [
                                "还没有密钥？",
                                /* @__PURE__ */ (0, react_jsx_runtime.jsx)(
                                  "a",
                                  {
                                    href: "https://open.bigmodel.cn/apikey/platform",
                                    target: "_blank",
                                    rel: "noreferrer",
                                    children: "前往智谱开放平台获取 API Key",
                                  },
                                ),
                              ],
                            }),
                          ],
                        },
                      )
                    : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(
                        react_jsx_runtime.Fragment,
                        {
                          children: [
                            /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(
                              "label",
                              {
                                style: field,
                                children: [
                                  /* @__PURE__ */ (0, react_jsx_runtime.jsx)(
                                    "span",
                                    {
                                      style: {
                                        fontSize: 13,
                                        fontWeight: 500,
                                      },
                                      children: "本地模型",
                                    },
                                  ),
                                  /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(
                                    "select",
                                    {
                                      style: input,
                                      value:
                                        read("modelPreset") || "qwen3-vl-2b",
                                      disabled,
                                      onChange: (event) => {
                                        edit("modelPreset", event.target.value);
                                      },
                                      children: [
                                        /* @__PURE__ */ (0,
                                        react_jsx_runtime.jsx)("option", {
                                          value: "qwen3-vl-2b",
                                          children: "Qwen3-VL 2B（推荐）",
                                        }),
                                        /* @__PURE__ */ (0,
                                        react_jsx_runtime.jsx)("option", {
                                          value: "qwen2-vl-2b",
                                          children: "Qwen2-VL 2B（兼容）",
                                        }),
                                      ],
                                    },
                                  ),
                                ],
                              },
                            ),
                            /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
                              style: {
                                margin: "8px 0 0",
                                color: "var(--dsw-alias-label-tertiary)",
                                fontSize: 12,
                              },
                              children:
                                "自动使用最新模型版本和合适的权重、设备。模型保存在 ~/.dsh/vision。",
                            }),
                          ],
                        },
                      ),
                  error !== null
                    ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
                        role: "status",
                        style: {
                          color: "var(--dsw-alias-label-error)",
                          fontSize: 12,
                        },
                        children: error,
                      })
                    : null,
                  /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
                    style: {
                      display: "flex",
                      justifyContent: "flex-end",
                      gap: 8,
                      marginTop: 14,
                    },
                    children: [
                      /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
                        type: "button",
                        style: secondary,
                        disabled:
                          saving ||
                          (Object.keys(draft).length === 0 && apiKey === ""),
                        onClick: () => {
                          setDraft({});
                          setApiKey("");
                          setError(null);
                        },
                        children: "放弃更改",
                      }),
                      /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
                        type: "button",
                        style: primary,
                        disabled:
                          disabled ||
                          (Object.keys(draft).length === 0 && apiKey === ""),
                        onClick: () => {
                          save();
                        },
                        children: saving ? "保存中…" : "保存",
                      }),
                    ],
                  }),
                ],
              })
            : null,
        ],
      });
    }
    //#endregion
    //#region src/client/vision-settings.ts
    const ENDPOINT = "/dsh-vision/settings";
    const HEADERS = {
      "content-type": "application/json",
      "x-dsh-vision": "dsh-vision",
    };
    /** Small same-origin settings client; avoids pretending vision is an LLM provider. */
    var VisionSettingsScope = class {
      snapshot = {
        status: "loading",
        writable: false,
      };
      listeners = /* @__PURE__ */ new Set();
      constructor() {
        this.refresh();
      }
      subscribe = (listener) => {
        this.listeners.add(listener);
        return () => {
          this.listeners.delete(listener);
        };
      };
      getSnapshot = () => this.snapshot;
      async set(name, value) {
        await this.write({
          op: "set",
          path: [name],
          value,
        });
      }
      async unset(name) {
        await this.write({
          op: "unset",
          path: [name],
        });
      }
      async write(op) {
        const response = await fetch(ENDPOINT, {
          method: "PATCH",
          headers: HEADERS,
          body: JSON.stringify({ ops: [op] }),
        });
        const body = await response.json();
        if (!response.ok || body.ok !== true || body.value === void 0)
          throw new Error(body.error ?? "设置保存失败");
        this.publish({
          status: "ready",
          value: body.value,
          writable: true,
        });
      }
      async refresh() {
        try {
          const response = await fetch(ENDPOINT, { headers: HEADERS });
          const body = await response.json();
          if (!response.ok || body.ok !== true || body.value === void 0)
            throw new Error("unavailable");
          this.publish({
            status: "ready",
            value: body.value,
            writable: true,
          });
        } catch {
          this.publish({
            status: "unavailable",
            writable: false,
          });
        }
      }
      publish(snapshot) {
        this.snapshot = snapshot;
        for (const listener of this.listeners) listener();
      }
    };
    //#endregion
    //#region src/client/index.ts
    /** Required services (fiber inject). */
    const inject = ["connection", "slots"];
    /**
     * Mount plugin settings. The Harness composer already owns native image
     * selection, previews, paste, drag/drop, and attachment submission.
     * @param ctx - the browser plugin context.
     */
    function apply(ctx) {
      const { api } = ctx.get("connection");
      const settings = new VisionSettingsScope();
      ctx.slots.inject("settings.plugin.item", function* () {
        yield ctx.slots.register(
          {
            name: "settings.plugin.item",
            id: "dsh-vision",
            order: 25,
            inject: () => ({
              scope: settings,
              api,
            }),
          },
          VisionSettingsCard,
        );
      });
    }
    //#endregion
    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  },
});
