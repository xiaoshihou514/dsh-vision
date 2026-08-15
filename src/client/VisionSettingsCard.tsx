/** Settings -> Plugins card for the host-side dsh-vision settings section. */

import {
  useEffect,
  useSyncExternalStore,
  useState,
  type CSSProperties,
} from "react";
import type { IApiClient } from "@deepseek-ai/dsh-client-connection/client";
import type { VisionSettingsScope } from "./vision-settings.ts";

export interface VisionSettings {
  backend?: "glm" | "qwen";
  modelPreset?: "qwen3-vl-2b" | "qwen2-vl-2b";
}

export interface VisionSettingsCardInjected {
  scope: VisionSettingsScope;
  api: Pick<IApiClient, "credentials">;
}

type Draft = Record<string, string>;

const card: CSSProperties = {
  listStyle: "none",
  border: "1px solid var(--dsw-alias-border-l2)",
  borderRadius: 12,
  background: "var(--dsw-alias-bg-layer-3)",
};
const header: CSSProperties = {
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
const field: CSSProperties = { display: "grid", gap: 5, marginTop: 12 };
const input: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  border: "1px solid var(--dsw-alias-border-l2)",
  borderRadius: 8,
  padding: "7px 9px",
  font: "inherit",
  color: "inherit",
  background: "var(--dsw-alias-bg-layer-3)",
};
const primary: CSSProperties = {
  appearance: "none",
  border: 0,
  borderRadius: 8,
  padding: "6px 14px",
  font: "inherit",
  cursor: "pointer",
  color: "var(--dsw-alias-bg-layer-3)",
  background: "var(--dsw-alias-label-primary)",
};
const secondary: CSSProperties = {
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

function text(value: unknown): string {
  return typeof value === "string" || typeof value === "number"
    ? String(value)
    : "";
}

function Field(props: {
  label: string;
  value: string;
  type?: "text" | "password" | "number";
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label style={field}>
      <span style={{ fontSize: 13, fontWeight: 500 }}>{props.label}</span>
      <input
        style={input}
        type={props.type ?? "text"}
        value={props.value}
        disabled={props.disabled}
        autoComplete={props.type === "password" ? "off" : undefined}
        onChange={(event) => {
          props.onChange(event.target.value);
        }}
      />
    </label>
  );
}

/** Editable vision backend card contributed to the native plugin configuration slot. */
export function VisionSettingsCard({ scope, api }: VisionSettingsCardInjected) {
  const snapshot = useSyncExternalStore(
    (listener) => scope.subscribe(listener),
    () => scope.getSnapshot(),
  );
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>({});
  const [apiKey, setApiKey] = useState("");
  const [keyConfigured, setKeyConfigured] = useState<boolean | undefined>();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stale = false;
    void api.credentials.describe({ refs: ["ZHIPUAI_API_KEY"] }).then(
      (response) => {
        if (stale || !response.result.ok) return;
        setKeyConfigured(
          response.result.value.credentials.ZHIPUAI_API_KEY?.configured ??
            false,
        );
      },
      () => undefined,
    );
    return () => {
      stale = true;
    };
  }, [api.credentials]);

  const value = snapshot.value ?? {};
  const read = (name: keyof VisionSettings): string =>
    draft[name] ?? text(value[name]);
  const edit = (name: keyof VisionSettings, next: string): void => {
    setDraft((current) => ({ ...current, [name]: next }));
    setError(null);
  };
  const backend = read("backend") === "qwen" ? "qwen" : "glm";
  const disabled = snapshot.status !== "ready" || !snapshot.writable || saving;

  const save = async (): Promise<void> => {
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
        if (!response.result.ok) throw new Error(response.result.error.message);
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

  return (
    <li style={card}>
      <button
        type="button"
        style={header}
        aria-expanded={open}
        aria-label={`${open ? "收起" : "展开"}：视觉识别`}
        onClick={() => {
          setOpen(!open);
        }}
      >
        <span style={{ display: "grid", gap: 4, flex: 1, minWidth: 0 }}>
          <strong style={{ fontSize: 15 }}>视觉识别</strong>
          <span
            style={{ color: "var(--dsw-alias-label-tertiary)", fontSize: 13 }}
          >
            配置 GLM 云端识图或本地 Qwen3-VL
          </span>
        </span>
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          aria-hidden="true"
          style={{
            color: "var(--dsw-alias-label-tertiary)",
            flex: "none",
            transform: open ? "rotate(180deg)" : undefined,
            transition: "transform .16s",
          }}
        >
          <path
            d="M11.8486 5.5L11.4238 5.92383L8.69727 8.65137C8.44157 8.90706 8.21562 9.13382 8.01172 9.29785C7.79912 9.46883 7.55595 9.61756 7.25 9.66602C7.08435 9.69222 6.91565 9.69222 6.75 9.66602C6.44405 9.61756 6.20088 9.46883 5.98828 9.29785C5.78438 9.13382 5.55843 8.90706 5.30273 8.65137L2.57617 5.92383L2.15137 5.5L3 4.65137L3.42383 5.07617L6.15137 7.80273C6.42595 8.07732 6.59876 8.24849 6.74023 8.3623C6.87291 8.46904 6.92272 8.47813 6.9375 8.48047C6.97895 8.48703 7.02105 8.48703 7.0625 8.48047C7.07728 8.47813 7.12709 8.46904 7.25977 8.3623C7.40124 8.24849 7.57405 8.07732 7.84863 7.80273L10.5762 5.07617L11 4.65137L11.8486 5.5Z"
            fill="currentColor"
          />
        </svg>
      </button>
      {open ? (
        <div
          style={{
            borderTop: "1px solid var(--dsw-alias-border-l2)",
            margin: "0 16px",
            padding: "2px 0 12px",
          }}
        >
          {snapshot.status === "unavailable" ? (
            <p
              role="status"
              style={{ color: "var(--dsw-alias-label-error)", fontSize: 12 }}
            >
              设置服务不可用，请检查 dsh-vision 是否完整加载。
            </p>
          ) : null}
          <label style={field}>
            <span style={{ fontSize: 13, fontWeight: 500 }}>识图后端</span>
            <select
              style={input}
              value={backend}
              disabled={disabled}
              onChange={(event) => {
                edit("backend", event.target.value);
              }}
            >
              <option value="glm">GLM 云端</option>
              <option value="qwen">Qwen3-VL 本地</option>
            </select>
          </label>
          {backend === "glm" ? (
            <>
              <div style={{ position: "relative" }}>
                <Field
                  label="API Key（仅写入凭据存储）"
                  type="password"
                  value={apiKey}
                  disabled={disabled}
                  onChange={setApiKey}
                />
                {keyConfigured !== undefined ? (
                  <span
                    role="status"
                    style={{
                      position: "absolute",
                      right: 0,
                      top: 12,
                      color: keyConfigured
                        ? "var(--dsw-alias-label-primary)"
                        : "var(--dsw-alias-label-tertiary)",
                      fontSize: 12,
                    }}
                  >
                    {keyConfigured ? "已配置" : "未配置"}
                  </span>
                ) : null}
              </div>
              <p
                style={{
                  margin: "8px 0 0",
                  color: "var(--dsw-alias-label-tertiary)",
                  fontSize: 12,
                }}
              >
                还没有密钥？
                <a
                  href="https://open.bigmodel.cn/apikey/platform"
                  target="_blank"
                  rel="noreferrer"
                >
                  前往智谱开放平台获取 API Key
                </a>
              </p>
            </>
          ) : (
            <>
              <label style={field}>
                <span style={{ fontSize: 13, fontWeight: 500 }}>本地模型</span>
                <select
                  style={input}
                  value={read("modelPreset") || "qwen3-vl-2b"}
                  disabled={disabled}
                  onChange={(event) => {
                    edit("modelPreset", event.target.value);
                  }}
                >
                  <option value="qwen3-vl-2b">Qwen3-VL 2B（推荐）</option>
                  <option value="qwen2-vl-2b">Qwen2-VL 2B（兼容）</option>
                </select>
              </label>
              <p
                style={{
                  margin: "8px 0 0",
                  color: "var(--dsw-alias-label-tertiary)",
                  fontSize: 12,
                }}
              >
                自动使用最新模型版本和合适的权重、设备。模型保存在
                ~/.dsh/vision。
              </p>
            </>
          )}
          {error !== null ? (
            <p
              role="status"
              style={{ color: "var(--dsw-alias-label-error)", fontSize: 12 }}
            >
              {error}
            </p>
          ) : null}
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 8,
              marginTop: 14,
            }}
          >
            <button
              type="button"
              style={secondary}
              disabled={
                saving || (Object.keys(draft).length === 0 && apiKey === "")
              }
              onClick={() => {
                setDraft({});
                setApiKey("");
                setError(null);
              }}
            >
              放弃更改
            </button>
            <button
              type="button"
              style={primary}
              disabled={
                disabled || (Object.keys(draft).length === 0 && apiKey === "")
              }
              onClick={() => {
                void save();
              }}
            >
              {saving ? "保存中…" : "保存"}
            </button>
          </div>
        </div>
      ) : null}
    </li>
  );
}
