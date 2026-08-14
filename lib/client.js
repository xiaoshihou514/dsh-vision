window.__ModuleLoader__.load({
	id: "dsh-vision",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		/**
		* Post image bytes to the dsh-vision translation endpoint and read the
		* evidence text. The endpoint requires a custom header, which forces a CORS
		* preflight on cross-site browsers the endpoint never answers.
		* @param payload - media type, base64 bytes, and optional focus text.
		* @param options - endpoint/header overrides and the fetch implementation (tests).
		* @returns evidence text on success, or a user-facing error.
		*/
		async function translateImage(payload, options = {}) {
			const endpoint = options.endpoint ?? "/dsh-vision/vision";
			const header = options.header ?? "x-dsh-vision";
			const headerValue = options.headerValue ?? "dsh-vision";
			try {
				const response = await (options.fetch ?? fetch)(endpoint, {
					method: "POST",
					headers: {
						"content-type": "application/json",
						[header]: headerValue
					},
					body: JSON.stringify({
						mediaType: payload.mediaType,
						data: payload.data,
						...payload.name === void 0 || payload.name === "" ? {} : { name: payload.name },
						...payload.focus === void 0 || payload.focus === "" ? {} : { focus: payload.focus }
					})
				});
				const body = await response.json();
				if (!response.ok || body.ok !== true || typeof body.text !== "string" || body.text.length === 0) return {
					ok: false,
					error: body.error ?? `translation failed (${response.status})`
				};
				return {
					ok: true,
					text: body.text
				};
			} catch (error) {
				return {
					ok: false,
					error: error instanceof Error ? error.message : String(error)
				};
			}
		}
		/**
		* Read one browser file as a base64 data payload.
		* @param file - browser-selected image file.
		* @returns the base64-encoded bytes without the data-URL prefix.
		*/
		function fileToBase64(file) {
			return new Promise((resolve, reject) => {
				const reader = new FileReader();
				reader.onload = () => {
					const result = reader.result;
					if (typeof result !== "string") {
						reject(/* @__PURE__ */ new Error("could not read the selected file"));
						return;
					}
					const comma = result.indexOf(",");
					resolve(comma === -1 ? result : result.slice(comma + 1));
				};
				reader.onerror = () => reject(/* @__PURE__ */ new Error("could not read the selected file"));
				reader.readAsDataURL(file);
			});
		}
		/** Whether a browser file's media type is accepted by the translation endpoint. */
		function supportedImageType(mediaType) {
			return mediaType === "image/png" || mediaType === "image/jpeg" || mediaType === "image/webp" || mediaType === "image/gif";
		}
		/**
		* Submit translated evidence as a plain-text message. Text-only content never
		* trips harness image admission, so any model on the session can answer.
		* @param api - host RPC client narrowed to message submission.
		* @param sessionId - owning session.
		* @param text - evidence text from the translation endpoint.
		* @returns submission outcome.
		*/
		async function submitEvidence(api, sessionId, text) {
			try {
				const response = await api.sessions.prompt({
					sessionId,
					mode: "queue",
					content: [{
						type: "text",
						text
					}]
				});
				if (!response.result.ok) return {
					ok: false,
					error: response.result.error.message
				};
				return { ok: true };
			} catch (error) {
				return {
					ok: false,
					error: error instanceof Error ? error.message : String(error)
				};
			}
		}
		//#endregion
		//#region src/client/UploadButton.tsx
		/** Composer tool-row entry: pick an image, translate it, send the evidence as text. @module dsh-vision/client/UploadButton */
		const ALLOWED_ACCEPT = "image/png,image/jpeg,image/webp,image/gif";
		/**
		* The "upload and recognize image" control: the selected file is translated
		* through the dsh-vision HTTP endpoint and its evidence is submitted as a
		* text-only message, so the harness image admission never applies — any model
		* on the session can answer.
		* @param props - injected api and session identity.
		*/
		function UploadButton({ api, sessionId }) {
			const inputRef = (0, react.useRef)(null);
			const [busy, setBusy] = (0, react.useState)(false);
			const [error, setError] = (0, react.useState)(null);
			const handleFile = async (file) => {
				if (file === void 0) return;
				if (!supportedImageType(file.type)) {
					setError("仅支持 PNG、JPEG、WebP 与 GIF 图片");
					return;
				}
				setBusy(true);
				setError(null);
				try {
					const data = await fileToBase64(file);
					const result = await translateImage({
						mediaType: file.type,
						data,
						...file.name === "" ? {} : { name: file.name }
					});
					if (!result.ok) {
						setError(result.error);
						return;
					}
					const response = await submitEvidence(api, sessionId, result.text);
					if (!response.ok) setError(response.error);
				} catch (caught) {
					setError(caught instanceof Error ? caught.message : String(caught));
				} finally {
					setBusy(false);
					if (inputRef.current !== null) inputRef.current.value = "";
				}
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
				className: "dsh-vision-upload",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						disabled: busy,
						onClick: () => inputRef.current?.click(),
						title: "上传图片并转换为文本描述后发送",
						children: busy ? "识别中…" : "上传图片"
					}),
					error !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "dsh-vision-upload-error",
						children: error
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
						ref: inputRef,
						type: "file",
						accept: ALLOWED_ACCEPT,
						hidden: true,
						onChange: (event) => {
							handleFile(event.target.files?.[0]);
						}
					})
				]
			});
		}
		//#endregion
		//#region src/client/VisionSettingsCard.tsx
		/** Settings -> Plugins card for the host-side dsh-vision settings section. */
		const card = {
			listStyle: "none",
			border: "1px solid var(--dsw-alias-border-l2)",
			borderRadius: 12,
			background: "var(--dsw-alias-bg-layer-3)"
		};
		const header = {
			width: "100%",
			appearance: "none",
			border: 0,
			background: "none",
			color: "inherit",
			font: "inherit",
			textAlign: "left",
			cursor: "pointer",
			padding: "14px 16px",
			display: "flex",
			alignItems: "center",
			gap: 12
		};
		const field = {
			display: "grid",
			gap: 5,
			marginTop: 12
		};
		const input = {
			width: "100%",
			boxSizing: "border-box",
			border: "1px solid var(--dsw-alias-border-l2)",
			borderRadius: 8,
			padding: "7px 9px",
			font: "inherit",
			color: "inherit",
			background: "var(--dsw-alias-bg-layer-3)"
		};
		const primary = {
			appearance: "none",
			border: 0,
			borderRadius: 8,
			padding: "6px 14px",
			font: "inherit",
			cursor: "pointer",
			color: "var(--dsw-alias-bg-layer-3)",
			background: "var(--dsw-alias-label-primary)"
		};
		function text(value) {
			return typeof value === "string" || typeof value === "number" ? String(value) : "";
		}
		function Field(props) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
				style: field,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					style: {
						fontSize: 13,
						fontWeight: 500
					},
					children: props.label
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
					style: input,
					type: props.type ?? "text",
					value: props.value,
					disabled: props.disabled,
					autoComplete: props.type === "password" ? "off" : void 0,
					onChange: (event) => {
						props.onChange(event.target.value);
					}
				})]
			});
		}
		/** Editable vision backend card contributed to the native plugin configuration slot. */
		function VisionSettingsCard({ scope, api }) {
			const snapshot = (0, react.useSyncExternalStore)((listener) => scope.subscribe(listener), () => scope.getSnapshot());
			const [open, setOpen] = (0, react.useState)(false);
			const [draft, setDraft] = (0, react.useState)({});
			const [apiKey, setApiKey] = (0, react.useState)("");
			const [saving, setSaving] = (0, react.useState)(false);
			const [error, setError] = (0, react.useState)(null);
			if (snapshot.status === "unavailable") return null;
			const value = snapshot.value ?? {};
			const read = (name) => draft[name] ?? text(value[name]);
			const edit = (name, next) => {
				setDraft((current) => ({
					...current,
					[name]: next
				}));
				setError(null);
			};
			const backend = read("backend") === "qwen" ? "qwen" : "glm";
			const disabled = snapshot.status !== "ready" || !snapshot.writable || saving;
			const save = async () => {
				if (disabled) return;
				setSaving(true);
				setError(null);
				try {
					const numeric = /* @__PURE__ */ new Set([
						"glmMaxTokens",
						"glmTimeoutMs",
						"maxNewTokens"
					]);
					for (const [name, raw] of Object.entries(draft)) {
						const trimmed = raw.trim();
						if (trimmed === "") await scope.unset(name);
						else if (numeric.has(name)) {
							const parsed = Number(trimmed);
							if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 1) throw new Error(`${name} 必须是正整数`);
							await scope.set(name, parsed);
						} else await scope.set(name, trimmed);
					}
					if (apiKey.trim() !== "") {
						const ref = read("apiKeyEnv").trim() || "ZHIPUAI_API_KEY";
						const response = await api.credentials.set({
							ref,
							value: apiKey.trim()
						});
						if (!response.result.ok) throw new Error(response.result.error.message);
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
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
					type: "button",
					style: header,
					"aria-expanded": open,
					onClick: () => {
						setOpen(!open);
					},
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						style: {
							display: "grid",
							gap: 4,
							flex: 1
						},
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", {
							style: { fontSize: 15 },
							children: "视觉识别"
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							style: {
								color: "var(--dsw-alias-label-tertiary)",
								fontSize: 13
							},
							children: "配置 GLM 云端识图或本地 Qwen3-VL"
						})]
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						"aria-hidden": "true",
						style: { transform: open ? "rotate(180deg)" : void 0 },
						children: "⌄"
					})]
				}), open ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					style: {
						borderTop: "1px solid var(--dsw-alias-border-l2)",
						margin: "0 16px",
						padding: "2px 0 12px"
					},
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
							style: field,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								style: {
									fontSize: 13,
									fontWeight: 500
								},
								children: "识图后端"
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
								style: input,
								value: backend,
								disabled,
								onChange: (event) => {
									edit("backend", event.target.value);
								},
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
									value: "glm",
									children: "GLM 云端"
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
									value: "qwen",
									children: "Qwen3-VL 本地"
								})]
							})]
						}),
						backend === "glm" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field, {
								label: "API Key（仅写入凭据存储）",
								type: "password",
								value: apiKey,
								disabled,
								onChange: setApiKey
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field, {
								label: "凭据名称",
								value: read("apiKeyEnv"),
								disabled,
								onChange: (next) => {
									edit("apiKeyEnv", next);
								}
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field, {
								label: "API 地址",
								value: read("baseURL"),
								disabled,
								onChange: (next) => {
									edit("baseURL", next);
								}
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field, {
								label: "GLM 模型",
								value: read("glmModel"),
								disabled,
								onChange: (next) => {
									edit("glmModel", next);
								}
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field, {
								label: "最大输出 tokens",
								type: "number",
								value: read("glmMaxTokens"),
								disabled,
								onChange: (next) => {
									edit("glmMaxTokens", next);
								}
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field, {
								label: "超时（毫秒）",
								type: "number",
								value: read("glmTimeoutMs"),
								disabled,
								onChange: (next) => {
									edit("glmTimeoutMs", next);
								}
							})
						] }) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field, {
								label: "模型仓库",
								value: read("modelId"),
								disabled,
								onChange: (next) => {
									edit("modelId", next);
								}
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field, {
								label: "模型 revision",
								value: read("revision"),
								disabled,
								onChange: (next) => {
									edit("revision", next);
								}
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field, {
								label: "权重格式",
								value: read("dtype"),
								disabled,
								onChange: (next) => {
									edit("dtype", next);
								}
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field, {
								label: "运行设备",
								value: read("device"),
								disabled,
								onChange: (next) => {
									edit("device", next);
								}
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field, {
								label: "模型缓存目录",
								value: read("cacheDir"),
								disabled,
								onChange: (next) => {
									edit("cacheDir", next);
								}
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field, {
								label: "最大输出 tokens",
								type: "number",
								value: read("maxNewTokens"),
								disabled,
								onChange: (next) => {
									edit("maxNewTokens", next);
								}
							})
						] }),
						error !== null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							role: "status",
							style: {
								color: "var(--dsw-alias-label-error)",
								fontSize: 12
							},
							children: error
						}) : null,
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							style: {
								display: "flex",
								justifyContent: "flex-end",
								gap: 8,
								marginTop: 14
							},
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								disabled: saving || Object.keys(draft).length === 0 && apiKey === "",
								onClick: () => {
									setDraft({});
									setApiKey("");
									setError(null);
								},
								children: "放弃更改"
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								style: primary,
								disabled: disabled || Object.keys(draft).length === 0 && apiKey === "",
								onClick: () => {
									save();
								},
								children: saving ? "保存中…" : "保存"
							})]
						})
					]
				}) : null]
			});
		}
		//#endregion
		//#region src/client/index.ts
		/** Required services (fiber inject). */
		const inject = [
			"connection",
			"settingsScope",
			"slots"
		];
		/**
		* Mount the composer entry: an "upload image" control that translates the
		* selected image through the dsh-vision endpoint and submits the evidence as
		* a plain-text message, bypassing harness image admission entirely.
		* @param ctx - the browser plugin context.
		*/
		function apply(ctx) {
			const { api } = ctx.get("connection");
			ctx.inject(["slots"], (scope) => {
				scope.slots.inject("conversation.input.left", () => scope.slots.register({
					name: "conversation.input.left",
					id: "dsh-vision-upload",
					order: 100,
					inject: (sessionId) => ({
						api,
						sessionId
					})
				}, UploadButton));
			});
			const settings = ctx.settingsScope.bind({ namespace: "dsh-vision" });
			ctx.slots.inject("settings.plugin.item", function* () {
				yield ctx.slots.register({
					name: "settings.plugin.item",
					id: "dsh-vision",
					order: 25,
					inject: () => ({
						scope: settings,
						api
					})
				}, VisionSettingsCard);
			});
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
