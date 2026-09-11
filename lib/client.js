window.__ModuleLoader__.load({
	id: "dsh-key-palette-b",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		const React = require("react");

		// Shared UI primitives ride the shell's frozen module table
		// (PLATFORM_MODULES in dsh-client-web/src/platform.ts): the same module
		// identity the app itself renders, styles included — the hashed CSS
		// module classes Modal renders are already styled by the app bundle, so
		// the palette chrome is standardized by construction and cannot drift.
		// Guarded: if the table ever lacks the row, the palette falls back to
		// its own token-level chrome below.
		let Modal = null;
		let TitleIcon = null;
		let IconClose = null;
		try {
			const primitives = require("@deepseek-ai/dsh-client-ui-primitives");
			Modal = primitives.Modal;
			// The settings dialog renders the gear (IconSettingsOutline16) to
			// the left of its nav rows, including "Shortcuts" (navIcon()'s
			// default branch); reuse the same glyphs for palette parity.
			TitleIcon = primitives.IconSettingsOutline16;
			IconClose = primitives.IconCloseOutline16;
		} catch { Modal = null; }

		// Hard dependencies ensure apply() waits until the current DSH Client
		// services used by the palette and its built-in actions are mounted.
		// Without this gate the bundle can load before `slots`, permanently skip
		// both UI registrations, and leave Ctrl+/ toggling invisible state.
		const inject = ["layout", "locale", "sessions", "slots", "theme", "timer", "uiWorkspace", "workspaces"];

		/**
		 * dsh-key-palette-b — client half.
		 *
		 * Public extension surface (documented in README.md):
		 *   const keys = ctx.get('keys.actions')
		 *   keys.register({ id, label, description?, run }) => disposer
		 *   keys.list() / keys.subscribe(fn)
		 *
		 * Any web plugin (or dynamic plugin) in the same app can register
		 * bindable behaviors; users bind shortcuts to them in the Cmd+/
		 * palette or in Settings → Shortcuts. Bindings persist per browser
		 * profile in localStorage (`dsh.key-palette-b.v1`).
		 */

		// ================= pure helpers =================
		const IS_MAC = (() => {
			try {
				return String(navigator.platform || "").toLowerCase().includes("mac");
			} catch {
				return false;
			}
		})();

		function normalizeKey(key) {
			if (key === " ") return "Space";
			if (key.length === 1 && key >= "a" && key <= "z") return key.toUpperCase();
			return key;
		}

		function parseCombo(combo) {
			const parts = combo.split("+");
			const key = normalizeKey(parts.pop());
			let mod = false, meta = false, ctrl = false, alt = false, shift = false;
			for (const p of parts) {
				if (p === "Mod") mod = true;
				else if (p === "Meta" || p === "Cmd") meta = true;
				else if (p === "Ctrl" || p === "Control") ctrl = true;
				else if (p === "Alt" || p === "Option") alt = true;
				else if (p === "Shift") shift = true;
			}
			return { mod, meta, ctrl, alt, shift, key };
		}

		function comboFromEvent(e) {
			const parts = [];
			if (IS_MAC && e.metaKey) parts.push("Mod");
			if (!IS_MAC && e.ctrlKey) parts.push("Mod");
			if (!IS_MAC && e.metaKey) parts.push("Meta");
			if (IS_MAC && e.ctrlKey) parts.push("Ctrl");
			if (e.altKey) parts.push("Alt");
			if (e.shiftKey) parts.push("Shift");
			// Brackets are matched by physical key (e.code): with Shift held,
			// e.key is layout-dependent ("{" on US, something else elsewhere),
			// while BracketLeft/BracketRight is stable across layouts.
			parts.push(e.code === "BracketLeft" ? "BracketLeft"
				: e.code === "BracketRight" ? "BracketRight"
				: normalizeKey(e.key));
			return parts.join("+");
		}

		function matches(e, combo) {
			const c = parseCombo(combo);
			const wantMeta = c.meta || (c.mod && IS_MAC);
			const wantCtrl = c.ctrl || (c.mod && !IS_MAC);
			if (e.metaKey !== wantMeta) return false;
			if (e.ctrlKey !== wantCtrl) return false;
			if (e.altKey !== c.alt) return false;
			if (e.shiftKey !== c.shift) return false;
			return normalizeKey(e.key) === c.key || (typeof e.code === "string" && e.code === c.key);
		}

		const TRIGGER_COMBOS = ["Mod+/", "Mod+／"];

		function isTrigger(e) {
			const primary = IS_MAC ? e.metaKey : e.ctrlKey;
			return primary && !e.altKey && !e.shiftKey && !(IS_MAC ? e.ctrlKey : e.metaKey) && (e.key === "/" || e.key === "／");
		}

		// Key names are always spelled out as text (no icon glyphs).
		const MOD_MAP = IS_MAC
			? { Mod: "Cmd", Meta: "Cmd", Ctrl: "Ctrl", Alt: "Alt", Shift: "Shift", Space: "Space", ArrowUp: "Up", ArrowDown: "Down", ArrowLeft: "Left", ArrowRight: "Right", Enter: "Enter", Escape: "Esc", Backspace: "Backspace", BracketLeft: "[", BracketRight: "]" }
			: { Mod: "Ctrl", Meta: "Win", Ctrl: "Ctrl", Alt: "Alt", Shift: "Shift", Space: "Space", ArrowUp: "Up", ArrowDown: "Down", ArrowLeft: "Left", ArrowRight: "Right", Enter: "Enter", Escape: "Esc", Backspace: "Backspace", BracketLeft: "[", BracketRight: "]" };

		function prettyParts(combo) {
			const parts = combo.split("+");
			const key = normalizeKey(parts.pop());
			const names = parts.map(p => MOD_MAP[p] || p);
			names.push(MOD_MAP[key] || key);
			return names;
		}

		function prettyCombo(combo) {
			if (!combo) return "";
			return prettyParts(combo).join("+");
		}

		function isEditable(target) {
			if (!target || typeof target.tagName !== "string") return false;
			const tag = target.tagName.toLowerCase();
			return tag === "input" || tag === "textarea" || target.isContentEditable === true;
		}

		// ================= i18n (zh / en, follows DSH locale) =================
		const I18N = {
			zh: {
				paletteTitle: "快捷键面板",
				settingsPageTitle: "快捷键",
				ariaClose: "关闭",
				unbound: "未绑定",
				btnRecord: "录制",
				btnClear: "清除",
				btnCancel: "取消",
				btnReset: "恢复默认",
				recording: "请按下组合键…（Esc 取消）",
				errNoMod: "组合键必须包含 Cmd / Ctrl / Alt 至少一个",
				errReserved: "该组合是面板触发键，不可绑定",
				errConflict: "与「{name}」冲突",
				footerNote: "绑定保存在本浏览器（localStorage），刷新后仍有效；被浏览器占用的组合（如 Cmd+S）不会触发。其他插件可通过 keys.actions 注册更多行为。",
				settingsNote: "为 DSH 行为绑定自定义快捷键。绑定保存在本浏览器（localStorage）。面板触发键固定为 {combo}（macOS Cmd+/，其他平台 Ctrl+/）。",
				settingsFooter: "行为列表包含本插件内置动作，以及通过 keys.actions 注册的其他插件动作。",
				actToggleSidebar: "切换侧边栏",
				actToggleSidebarDesc: "开合左侧工作区栏",
				actShowConversation: "显示会话面板",
				actShowConversationDesc: "切换回中央会话面板",
				actToggleRightSidebar: "切换右侧边栏",
				actToggleRightSidebarDesc: "展开或收起右侧边栏（DSH 现行界面术语；旧称“详情栏”）",
				actOpenSettings: "打开设置",
				actOpenSettingsDesc: "打开设置弹窗（无公开服务，模拟点击侧边栏入口）",
				actFocusSearch: "聚焦会话搜索",
				actFocusSearchDesc: "展开左侧栏并聚焦会话搜索框（无公开服务，模拟点击搜索按钮）",
				actFocusComposer: "聚焦输入框",
				actFocusComposerDesc: "将焦点移到聊天输入框（无公开服务，直接聚焦编辑器元素）",
				actNewSession: "新建会话",
				actNewSessionDesc: "在当前或最近的工作区开启新会话",
				actPrevSession: "上一会话",
				actPrevSessionDesc: "按最近使用顺序打开上一个会话（连续切换时顺序冻结 5 秒）",
				actNextSession: "下一会话",
				actNextSessionDesc: "按最近使用顺序打开下一个会话（连续切换时顺序冻结 5 秒）",
				actOpenWorkspace: "打开工作区",
				actOpenWorkspaceDesc: "选择目录，注册为工作区并打开",
				actCycleTheme: "切换明暗主题",
				actCycleThemeDesc: "light → dark → system 循环",
				actCycleLocale: "切换界面语言",
				actCycleLocaleDesc: "在已安装的语言间循环",
			},
			en: {
				paletteTitle: "Shortcuts Palette",
				settingsPageTitle: "Shortcuts",
				ariaClose: "Close",
				unbound: "Unbound",
				btnRecord: "Record",
				btnClear: "Clear",
				btnCancel: "Cancel",
				btnReset: "Reset defaults",
				recording: "Press a key combo… (Esc to cancel)",
				errNoMod: "Combo must include at least one of Cmd / Ctrl / Alt",
				errReserved: "This combo is the palette trigger and is reserved",
				errConflict: "Conflicts with {name}",
				footerNote: "Bindings are saved in this browser (localStorage) and survive refreshes; combos reserved by the browser (e.g. Cmd+S) won't fire. Other plugins can register more actions via keys.actions.",
				settingsNote: "Bind custom shortcuts to DSH behaviors. Bindings are saved in this browser (localStorage). The palette trigger is fixed at {combo} (Cmd+/ on macOS, Ctrl+/ elsewhere).",
				settingsFooter: "The list includes built-in actions plus actions registered by other plugins via keys.actions.",
				actToggleSidebar: "Toggle Sidebar",
				actToggleSidebarDesc: "Show or hide the left workspace bar",
				actShowConversation: "Show Conversation",
				actShowConversationDesc: "Switch back to the central Conversation panel",
				actToggleRightSidebar: "Toggle Right Sidebar",
				actToggleRightSidebarDesc: "Expand or collapse the right sidebar (current DSH nomenclature; formerly \"Details\")",
				actOpenSettings: "Open Settings",
				actOpenSettingsDesc: "Open the settings dialog (no public service; clicks the sidebar trigger)",
				actFocusSearch: "Focus Session Search",
				actFocusSearchDesc: "Expand the left sidebar and focus the session search box (no public service; clicks the search button)",
				actFocusComposer: "Focus Composer",
				actFocusComposerDesc: "Move focus to the chat input box (no public service; focuses the editor element directly)",
				actNewSession: "New Session",
				actNewSessionDesc: "Start a new session in the current or most recent workspace",
				actPrevSession: "Previous Session",
				actPrevSessionDesc: "Open the previous session in recently-touched order (the order freezes for 5s while you keep switching)",
				actNextSession: "Next Session",
				actNextSessionDesc: "Open the next session in recently-touched order (the order freezes for 5s while you keep switching)",
				actOpenWorkspace: "Open Workspace",
				actOpenWorkspaceDesc: "Choose a directory, register it as a workspace, and open it",
				actCycleTheme: "Cycle Theme",
				actCycleThemeDesc: "Cycle light → dark → system",
				actCycleLocale: "Cycle UI Language",
				actCycleLocaleDesc: "Cycle through installed languages",
			},
		};

		// ================= styles (DSH design language, settings-modal chrome) =================
		// The settings modal (ui-settings-general SettingsRoot.module.css) is a
		// CSS Module - its class names are hashed at build time and cannot be
		// imported or matched from plugin CSS. Its LOOK, however, is expressed
		// entirely in the global --dsw-* design tokens declared on body by
		// ui-theme, which any injected stylesheet in the same document may
		// consume. The rules below copy the modal's chrome verbatim from
		// SettingsRoot.module.css, token for token: full-viewport mask with
		// backdrop blur, r32 panel on bg-layer-2 with elevation-prominent, and
		// the l2 elevation scrollbar rebinding. Font is inherited from the app
		// (the modal sets no font of its own either).
		const CSS = `
.kpal-overlay{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;pointer-events:auto;animation:kpal-in .1s ease-out}
.kpal-overlay.kpal-out{animation:kpal-out .08s ease-in forwards}
@keyframes kpal-in{from{opacity:0}to{opacity:1}}
@keyframes kpal-out{to{opacity:0}}
@media (prefers-reduced-motion:reduce){.kpal-overlay,.kpal-overlay.kpal-out{animation-duration:.01ms}}
.kpal-mask{position:absolute;inset:0;background:var(--dsw-alias-bg-mask-1);backdrop-filter:var(--dsw-mask-blur)}
.kpal-panel{position:relative;z-index:1;display:flex;flex-direction:column;width:600px;max-width:calc(100vw - 48px);max-height:min(800px,calc(100vh - 48px));overflow:hidden;box-sizing:border-box;border-radius:32px;background:var(--dsw-alias-bg-layer-2);box-shadow:var(--dsw-elevation-prominent);color:var(--dsw-alias-label-primary);font-size:14px;line-height:1.5;--dsh-scrollbar-thumb:var(--dsw-alias-scrollbar-bg-l2);--dsh-scrollbar-thumb-hover:var(--dsw-alias-scrollbar-hover-l2)}
.kpal-header{flex:none;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:22px 14px 12px 24px;box-sizing:border-box}
.kpal-title{display:inline-flex;align-items:center;gap:8px;font-size:16px;line-height:24px;font-weight:500;color:var(--dsw-alias-label-primary);flex:1;min-width:0}
.kpal-close{display:inline-flex;align-items:center;justify-content:center;flex:none;width:28px;height:28px;padding:0;border:none;border-radius:28px;background:transparent;cursor:pointer;color:var(--dsw-alias-label-primary);font-size:14px}
.kpal-close:hover{background:var(--dsw-alias-interactive-bg-hover)}
.kpal-body{flex:1;min-height:0;overflow-y:auto;padding:0 24px 24px}
.kpal-modal-card{width:600px;max-width:100%;max-height:calc(100vh - 48px);gap:0;padding-bottom:0;--dsh-scrollbar-thumb:var(--dsw-alias-scrollbar-bg-l2);--dsh-scrollbar-thumb-hover:var(--dsw-alias-scrollbar-hover-l2)}
.kpal-kbd{display:inline-block;min-width:24px;text-align:center;padding:2px 8px;border:1px solid var(--dsw-alias-border-l2);border-bottom-width:2px;border-radius:6px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12px;white-space:nowrap}
.kpal-desc{flex:1;font-size:12px;font-weight:400;line-height:18px;color:var(--dsw-alias-label-tertiary)}
.kpal-action-name{flex:1;font-size:14px;font-weight:400;line-height:22px;color:var(--dsw-alias-label-primary)}
.kpal-action{display:flex;align-items:center;gap:10px;padding:8px 0}
.kpal-action-source{font-size:11px;color:var(--dsw-alias-label-secondary);font-weight:400;margin-left:6px}
.kpal-action-btns{display:inline-flex;gap:6px}
.kpal-btn{border:1px solid var(--dsw-alias-border-l2);background:transparent;color:var(--dsw-alias-label-primary);border-radius:6px;padding:4px 12px;font-size:13px;cursor:pointer}
.kpal-btn:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}
.kpal-btn:disabled{opacity:.45;cursor:default}
.kpal-recording{color:var(--dsw-alias-brand-primary);font-size:13px;display:inline-flex;align-items:center;gap:8px}
.kpal-error{color:var(--dsw-alias-state-error-primary);font-size:13px;padding:2px 0 6px}
.kpal-combo{display:inline-flex;align-items:center;gap:3px;margin-right:10px}
.kpal-unbound{color:var(--dsw-alias-label-secondary);font-size:13px;font-style:italic;margin-right:10px}
.kpal-footer{margin-top:12px;padding-top:10px;border-top:0.5px solid var(--dsw-alias-border-l2);font-size:12px;color:var(--dsw-alias-label-secondary);display:flex;align-items:center;gap:10px}
.kpal-footer-note{flex:1}
.kpal-page{padding:2px 0 12px}
.kpal-page-note{font-size:12px;color:var(--dsw-alias-label-secondary);margin-bottom:10px;line-height:1.6}
`;

		// ================= built-in action definitions =================
		function cycleTheme(ctx) {
			const theme = ctx.get("theme");
			if (!theme) return;
			const order = ["light", "dark", "system"];
			const current = theme.getTheme().preference;
			const next = order[(order.indexOf(current) + 1) % order.length];
			theme.setTheme(next);
		}

		function cycleLocale(ctx) {
			const locale = ctx.get("locale");
			if (!locale) return;
			let snap;
			try { snap = locale.getSnapshot(); } catch { return; }
			if (!snap || !Array.isArray(snap.locales) || !snap.locales.length) return;
			const ids = snap.locales.map(l => (l && typeof l.id === "string") ? l.id : null).filter(Boolean);
			if (!ids.length) return;
			const idx = ids.indexOf(snap.active);
			const next = ids[(idx + 1 + ids.length) % ids.length];
			locale.setLocale(next);
		}

		async function openWorkspace(ctx) {
			const uiWorkspace = ctx.get("uiWorkspace");
			const workspaces = ctx.get("workspaces");
			if (!uiWorkspace || !workspaces) return;
			const path = await uiWorkspace.pickDirectory();
			if (!path) return;
			const workspace = await workspaces.create({ path });
			await uiWorkspace.openWorkspace(workspace.workspaceId);
		}

		// ================= session recency walk (prev / next) =================
		// Pure service-driven: candidates come from the Session list snapshot
		// (minus archived, blank, and subagent rows) sorted by updatedAt —
		// the same "recently touched" field the sidebar orders by. Opening a
		// session does NOT bump its updatedAt (only durable messages do), so
		// the walk is stable by construction; the freeze below only guards
		// against background sessions emitting messages mid-walk.
		const SESSION_WALK_FREEZE_MS = 5000;
		const sessionWalk = { ids: null, pos: 0, at: 0 };

		function sessionWalkSnapshot(ctx) {
			const now = Date.now();
			if (sessionWalk.ids && now - sessionWalk.at < SESSION_WALK_FREEZE_MS) return sessionWalk.ids;
			const sessions = ctx.get("sessions");
			const workspaces = ctx.get("workspaces");
			if (!sessions || !workspaces) return null;
			let list = null;
			try { list = sessions.list.getSnapshot(); } catch { /* not ready */ }
			if (!list || !Array.isArray(list.ids) || !list.byId) return null;
			let archived = new Set();
			try {
				const snap = workspaces.list.getSnapshot();
				if (snap && Array.isArray(snap.archivedSessionIds)) {
					archived = new Set(snap.archivedSessionIds);
				}
			} catch { /* keep the empty set */ }
			const rows = [];
			for (const id of list.ids) {
				if (!id) continue;
				const summary = list.byId[id];
				if (!summary || summary.blank || summary.origin === "subagent" || archived.has(id)) continue;
				// The id IS the map key — never trust a sessionId field on
				// the row (some snapshot lifecycle stages carry partial rows).
				rows.push({ id, updatedAt: summary.updatedAt || 0 });
			}
			rows.sort((a, b) => b.updatedAt - a.updatedAt);
			sessionWalk.ids = rows.map(row => row.id);
			// Position from the live current session; when it is not a
			// walkable row (subagent route, archived, …) fall back to its
			// recency insertion point, or the top of the list when unknown.
			let pos = sessionWalk.ids.indexOf(list.current);
			if (pos === -1) {
				const current = list.current !== undefined ? list.byId[list.current] : undefined;
				const stamp = current ? (current.updatedAt || 0) : Number.POSITIVE_INFINITY;
				pos = rows.reduce((count, row) => count + (row.updatedAt > stamp ? 1 : 0), 0);
			}
			sessionWalk.pos = pos;
			return sessionWalk.ids;
		}

		function stepSession(ctx, delta) {
			const ids = sessionWalkSnapshot(ctx);
			if (!ids || !ids.length) {
				// Distinguish "nothing to walk" from "services not reachable"
				// (e.g. the profile's boot graph predates this plugin's
				// session-controller inject declaration — restart dsh).
				if (!ctx.get("sessions") || !ctx.get("workspaces")) {
					console.warn("[keys-palette] session walk unavailable: sessions/workspaces service not reachable (restart dsh to recompose the boot graph)");
				}
				return;
			}
			// Every walk command refreshes the freeze window, so a burst of
			// prev/next presses keeps walking one fixed ordering.
			sessionWalk.at = Date.now();
			const pos = Math.min(Math.max(sessionWalk.pos + delta, 0), ids.length - 1);
			if (pos === sessionWalk.pos) return; // clamped at either end — a no-op
			const uiWorkspace = ctx.get("uiWorkspace");
			if (!uiWorkspace) return;
			sessionWalk.pos = pos;
			try { uiWorkspace.openSession(ids[pos]); } catch (err) {
				console.error("[keys-palette] session walk failed:", err);
			}
		}

		// Feature flag: nothing in a stock DSH install registers a main-slot
		// panel (Settings is a modal), so `show-conversation` — returning the
		// main area to the Conversation from such a panel — is an invisible
		// no-op today. Flip to true if third-party full-page panels appear.
		const FEATURE_SHOW_CONVERSATION = false;

		function builtinDefs(ctx) {
			return [
				{ id: "new-session", labelKey: "actNewSession", descriptionKey: "actNewSessionDesc", run: () => { const s = ctx.get("uiWorkspace"); if (s) s.startSession(); } },
				{ id: "session-prev", labelKey: "actPrevSession", descriptionKey: "actPrevSessionDesc", run: () => stepSession(ctx, -1) },
				{ id: "session-next", labelKey: "actNextSession", descriptionKey: "actNextSessionDesc", run: () => stepSession(ctx, 1) },
				{ id: "toggle-sidebar", labelKey: "actToggleSidebar", descriptionKey: "actToggleSidebarDesc", run: () => { const s = ctx.get("layout"); if (s) s.toggleSidebar(); } },
				...(FEATURE_SHOW_CONVERSATION ? [
					{ id: "show-conversation", labelKey: "actShowConversation", descriptionKey: "actShowConversationDesc", run: () => { const s = ctx.get("layout"); if (s) s.selectPanel(null); } },
				] : []),
				// Named for the CURRENT DSH UI nomenclature: the column DSH
				// itself calls the "right sidebar" (chrome.expandAria: "Open
				// right sidebar") — "Details" was the pre-rework name and
				// appears nowhere in the current tree.
				// The right-hand Sidebar owns its own presentation state; the
				// layout store is only a downstream sync target (the shell's
				// syncPresentation overwrites any direct layout.openRightbar/
				// closeRightbar write), so drive ctx.sidebarRight instead.
				{ id: "toggle-right-sidebar", labelKey: "actToggleRightSidebar", descriptionKey: "actToggleRightSidebarDesc", run: () => {
					const s = ctx.get("sidebarRight");
					if (!s || typeof s.toggleExpanded !== "function") return;
					try { s.toggleExpanded(); } catch (err) { console.error("[keys-palette] toggle-right-sidebar failed:", err); }
				} },
				// NECESSARY DOM REACH-OUT (minimal): the chat composer is a
				// Lexical editor whose focus path is internal to
				// ui-conversation (InputBar focuses the root element on
				// unlock; the input contract is types-only) — no service or
				// event reaches it. The cleanest anchor of all DOM actions
				// here: the contenteditable root carries a purpose-built
				// data-composer-input attribute, and a plain .focus() is
				// exactly what DSH itself does (Lexical's editor.focus()
				// bottoms out in a native focus on that element; its
				// native-focus listener restores the selection). No timing,
				// no state reads, no locale-dependent selectors. A disabled
				// or absent composer (locked submit, no session) is a
				// harmless no-op / warning.
				{ id: "focus-composer", labelKey: "actFocusComposer", descriptionKey: "actFocusComposerDesc", run: () => {
					const el = document.querySelector("[data-composer-input]");
					if (!el) {
						console.warn("[keys-palette] composer not found (no session or DSH markup changed)");
						return;
					}
					el.focus({ preventScroll: true });
				} },
				// NECESSARY DOM REACH-OUT (partial): session search lives in
				// ui-workspace's WorkspaceBrowser as component-local state
				// (searchExpanded useState + input ref focus) — no service or
				// event can open it. The EXPAND half rides the public API
				// (layout.toggleSidebar), but the toggle is blind, so the
				// frame's data-sidebar-collapsed attribute (asserted by DSH's
				// own e2e suite) is read first to decide whether to toggle.
				// The FOCUS half clicks the wide-mode search button, located
				// by its localized accessible name ("Search sessions" /
				// 搜索会话; DSH ships only en/zh). The click must land AFTER
				// the column slide (EXPAND_SLIDE_MS = 300 in WorkspaceBrowser
				// — the same wait DSH's own searchOnExpand effect performs),
				// because the wide-mode button only mounts once wide. When
				// already expanded, skip toggle and delay and click at once;
				// the button click is idempotent (re-focus). If DSH ever
				// exposes a focusSearch() face, swap the body for it.
				{ id: "focus-search", labelKey: "actFocusSearch", descriptionKey: "actFocusSearchDesc", run: () => {
					const labels = ["Search sessions", "搜索会话"];
					const clickSearch = () => {
						const buttons = [...document.querySelectorAll("button")];
						const target = buttons.find(b => labels.includes(b.getAttribute("aria-label")));
						if (!target) {
							console.warn("[keys-palette] search button not found (sidebar hidden or DSH markup changed)");
							return;
						}
						target.click();
					};
					const frame = document.querySelector("[data-sidebar-collapsed]");
					if (frame) {
						const layout = ctx.get("layout");
						if (!layout) return;
						try { layout.toggleSidebar(); } catch (err) {
							console.error("[keys-palette] focus-search expand failed:", err);
							return;
						}
						setTimeout(clickSearch, 300);
					} else {
						clickSearch();
					}
				} },
				{ id: "open-workspace", labelKey: "actOpenWorkspace", descriptionKey: "actOpenWorkspaceDesc", run: () => openWorkspace(ctx) },
				// NECESSARY DOM REACH-OUT: unlike every other action here, this
				// one cannot go through a ctx service. Settings is a modal
				// whose open state is component-local React state inside
				// ui-settings-general's SettingsRoot (useState) — nothing in
				// the DSH plugin API exposes it: no provided service, no
				// event to dispatch, no URL/route to navigate. The ONLY lever
				// a plugin holds is the DOM: synthesize a click on the
				// sidebar-foot trigger button. It is located by its dialog
				// role hint (aria-haspopup) plus the localized "Settings"
				// accessible name (DSH ships only en/zh dictionaries), which
				// disambiguates it from the chat usage pills that also use
				// aria-haspopup="dialog". This is best-effort by nature: if
				// DSH restyles or renames the trigger, or ever adds a real
				// openSettings() face, swap this body for the public API.
				{ id: "open-settings", labelKey: "actOpenSettings", descriptionKey: "actOpenSettingsDesc", run: () => {
					const labels = ["Settings", "设置"];
					const buttons = [...document.querySelectorAll('button[aria-haspopup="dialog"]')];
					const trigger = buttons.find(b => labels.includes(b.getAttribute("aria-label")));
					if (!trigger) {
						console.warn("[keys-palette] settings trigger not found (sidebar hidden or DSH markup changed)");
						return;
					}
					trigger.click();
				} },
				{ id: "cycle-theme", labelKey: "actCycleTheme", descriptionKey: "actCycleThemeDesc", run: () => cycleTheme(ctx) },
				{ id: "cycle-locale", labelKey: "actCycleLocale", descriptionKey: "actCycleLocaleDesc", run: () => cycleLocale(ctx) },
			];
		}

		function localeFamily(id) {
			return String(id || "").toLowerCase().startsWith("zh") ? "zh" : "en";
		}

		// Resolve the current UI language: follow the DSH locale service, fall
		// back to the browser language.
		function detectLocale(ctx) {
			const locale = ctx.get("locale");
			if (locale && typeof locale.getSnapshot === "function") {
				try {
					const snap = locale.getSnapshot();
					if (snap && typeof snap.active === "string") return localeFamily(snap.active);
				} catch { /* fall through */ }
			}
			try {
				return localeFamily(navigator.language || "en");
			} catch {
				return "en";
			}
		}

		// ================= public extension service =================
		// keys.actions — provided app-wide via the current Context service
		// publication API (`ctx.provide`).
		// `translate` resolves labelKey/descriptionKey at read time so action
		// names follow the DSH locale on the fly.
		function createRegistry(ctx, translate) {
			const actions = new Map();
			const listeners = new Set();
			const selfName = (ctx.fiber && ctx.fiber.name) || "";
			const source = selfName || "unknown";
			const labelOf = (a) => (a.labelKey ? translate(a.labelKey) : a.label);
			const descriptionOf = (a) => (a.descriptionKey ? translate(a.descriptionKey) : a.description);
			const registry = {
				register(def) {
					if (!def || typeof def.id !== "string" || !def.id || typeof def.run !== "function") {
						console.error("[keys-palette] keys.actions.register requires { id: string, run: fn, label?: string }");
						return () => {};
					}
					if (actions.has(def.id)) {
						console.error("[keys-palette] action id already registered: " + def.id);
						return () => {};
					}
					const entry = {
						id: def.id,
						label: def.label || def.id,
						description: def.description || "",
						labelKey: def.labelKey || null,
						descriptionKey: def.descriptionKey || null,
						source: def.source || source,
						run: def.run,
					};
					actions.set(def.id, entry);
					for (const fn of listeners) fn();
					return () => {
						if (actions.delete(def.id)) {
							for (const fn of listeners) fn();
						}
					};
				},
				list() {
					return [...actions.values()].map(a => ({ id: a.id, label: labelOf(a), description: descriptionOf(a), source: a.source }));
				},
				subscribe(fn) {
					listeners.add(fn);
					return () => listeners.delete(fn);
				},
			};
			return { registry, actions, selfName, labelOf };
		}

		function apply(ctx) {
			// Double-mount guard: switching install channels (install.sh vs
			// dsh plugin bundles) can mount two instances; only one may own the
			// keydown listener, the registry, and the style tag.
			if (window.__dshKeysPaletteMounted) {
				console.warn("[keys-palette] already mounted — skipping duplicate instance (check for two install channels).");
				return;
			}
			window.__dshKeysPaletteMounted = true;
			ctx.effect(() => () => { window.__dshKeysPaletteMounted = false; });

			// Own style tag first, so a failure later in apply can never leak it.
			const styleEl = document.createElement("style");
			styleEl.textContent = CSS;
			document.head.appendChild(styleEl);
			ctx.effect(() => () => styleEl.remove());

			// ---------------- i18n: follow the DSH locale ----------------
			let currentLocale = detectLocale(ctx);
			function translate(key, vars) {
				const dict = I18N[currentLocale] || I18N.en;
				let text = dict[key] !== undefined ? dict[key] : (I18N.en[key] !== undefined ? I18N.en[key] : key);
				if (vars) {
					for (const k of Object.keys(vars)) {
						text = String(text).split("{" + k + "}").join(String(vars[k]));
					}
				}
				return text;
			}

			const { registry, actions, selfName, labelOf } = createRegistry(ctx, translate);

			// Publish the public service for the whole app (other plugins can
			// ctx.get('keys.actions') and register their own behaviors). Current
			// Cordis clients expose service publication directly on the Context.
			// A duplicate provide must not kill the instance.
			try {
				ctx.effect(() => ctx.provide("keys.actions", registry));
			} catch (err) {
				console.warn("[keys-palette] keys.actions could not be provided:", err);
			}

			// Register our own built-ins through the same public API.
			const builtinDisposers = builtinDefs(ctx).map(d => registry.register(d));
			ctx.effect(() => () => { for (const d of builtinDisposers) d(); });

			// ================= store + persistence =================
			const STORAGE_KEY = "dsh.key-palette-b.v1";
			const DEFAULTS = {
				"new-session": "Mod+Shift+Enter",
				"session-prev": "Mod+Shift+BracketLeft",
				"session-next": "Mod+Shift+BracketRight",
				"toggle-sidebar": "Mod+Shift+E",
				...(FEATURE_SHOW_CONVERSATION ? { "show-conversation": null } : {}),
				"toggle-right-sidebar": null,
				"focus-composer": null,
				"focus-search": "Mod+Shift+F",
				"open-workspace": null,
				"open-settings": "Mod+Comma",
				"cycle-theme": "Mod+Shift+K",
				"cycle-locale": null,
			};

			// Validate one stored combo: >= 1 known modifier part + a key part.
			function isValidCombo(combo) {
				if (typeof combo !== "string" || !combo) return false;
				const parts = combo.split("+");
				if (parts.length < 2 || !parts[parts.length - 1]) return false;
				const mods = parts.slice(0, -1);
				for (const m of mods) {
					if (m !== "Mod" && m !== "Meta" && m !== "Cmd" && m !== "Ctrl" && m !== "Control" && m !== "Alt" && m !== "Option" && m !== "Shift") return false;
				}
				return true;
			}

			function loadStored() {
				try {
					const raw = localStorage.getItem(STORAGE_KEY);
					if (!raw) return null;
					const parsed = JSON.parse(raw);
					if (!parsed || typeof parsed !== "object" || parsed.v !== 1) return null;
					const src = parsed.bindings;
					if (!src || typeof src !== "object") return null;
					// Sanitize every value: only valid combos or explicit nulls
					// survive; anything else degrades to "unbound".
					const bindings = {};
					for (const key of Object.keys(src)) {
						const value = src[key];
						bindings[key] = value === null || isValidCombo(value) ? value : null;
					}
					return bindings;
				} catch { /* storage unavailable or malformed */ }
				return null;
			}

			function saveStored(bindings) {
				try {
					localStorage.setItem(STORAGE_KEY, JSON.stringify({ v: 1, bindings }));
				} catch (err) {
					console.warn("[keys-palette] failed to persist bindings:", err);
				}
			}

			const listeners = new Set();
			let version = 0;
			let snapshotCache = null;
			const state = {
				open: false,
				recording: null,
				error: null,
				bindings: Object.assign({}, DEFAULTS, loadStored() || {}),
			};

			const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
			const getSnapshot = () => {
				if (snapshotCache === null) {
					snapshotCache = {
						version,
						open: state.open,
						recording: state.recording,
						error: state.error,
						bindings: state.bindings,
						actions: registry.list(),
					};
				}
				return snapshotCache;
			};
			const emit = () => {
				version += 1;
				snapshotCache = null;
				for (const fn of [...listeners]) fn();
			};
			const set = (patch) => {
				if (patch.bindings && patch.bindings !== state.bindings) {
					saveStored(patch.bindings);
				}
				Object.assign(state, patch);
				emit();
			};
			ctx.effect(() => registry.subscribe(emit));

			// Follow the DSH locale: when the UI language switches, refresh the
			// translation state, remount slots (their labels localize too), and
			// re-render. No locale service → stays on the browser language.
			ctx.effect(() => {
				const locale = ctx.get("locale");
				if (!locale || typeof locale.subscribe !== "function") return;
				return locale.subscribe(() => {
					currentLocale = detectLocale(ctx);
					for (const d of slotCleanups) d();
					slotCleanups = [];
					mountSlots();
					emit();
				});
			});

			// ================= keydown dispatcher =================
			function handleKeydown(e) {
				if (e.isComposing || e.keyCode === 229) return;
				if (e.repeat) return;

				if (state.recording) {
					e.preventDefault();
					// Capture-phase stop: the Modal primitive listens for Escape on
					// document (bubble); without this, canceling a recording would
					// also close the palette in the same keystroke.
					e.stopPropagation();
					if (e.key === "Escape") { set({ recording: null, error: null }); return; }
					if (e.key === "Meta" || e.key === "Control" || e.key === "Alt" || e.key === "Shift") return;
					const combo = comboFromEvent(e);
					if (!(e.metaKey || e.ctrlKey || e.altKey)) {
						set({ error: { actionId: state.recording, message: translate("errNoMod") } });
						return;
					}
					if (TRIGGER_COMBOS.indexOf(combo) >= 0) {
						set({ error: { actionId: state.recording, message: translate("errReserved") } });
						return;
					}
					const conflict = [...actions.values()].find(a => a.id !== state.recording && state.bindings[a.id] === combo);
					if (conflict) {
						set({ error: { actionId: state.recording, message: translate("errConflict", { name: labelOf(conflict) }) } });
						return;
					}
					const bindings = Object.assign({}, state.bindings);
					bindings[state.recording] = combo;
					set({ bindings, recording: null, error: null });
					return;
				}

				if (isTrigger(e)) { e.preventDefault(); set({ open: !state.open }); return; }
				if (state.open && e.key === "Escape") { set({ open: false }); return; }

				const editable = isEditable(e.target);
				for (const action of actions.values()) {
					const combo = state.bindings[action.id];
					if (!combo) continue;
					const c = parseCombo(combo);
					const hasModifier = c.mod || c.meta || c.ctrl || c.alt;
					if (editable && !hasModifier) continue;
					if (matches(e, combo)) {
						e.preventDefault();
						try {
							const result = action.run();
							if (result && typeof result.then === "function") {
								result.catch(err => console.error("[keys-palette] binding failed for " + action.id + ":", err));
							}
						} catch (err) {
							console.error("[keys-palette] binding failed for " + action.id + ":", err);
						}
						break;
					}
				}
			}

			ctx.effect(() => {
				window.addEventListener("keydown", handleKeydown, true);
				return () => window.removeEventListener("keydown", handleKeydown, true);
			});

			// ================= shared binding rows UI =================
			function comboChips(combo, key) {
				if (!combo) return React.createElement("span", { className: "kpal-unbound", key }, translate("unbound"));
				return React.createElement("span", { className: "kpal-combo", key },
					prettyParts(combo).map((p, i) => React.createElement("span", { className: "kpal-kbd", key: i }, p)));
			}

			function bindingRows(stateSnap) {
				const rows = [];
				for (const action of stateSnap.actions) {
					const combo = stateSnap.bindings[action.id];
					const isRecording = stateSnap.recording === action.id;
					const error = stateSnap.error && stateSnap.error.actionId === action.id ? stateSnap.error.message : null;
					const showSource = action.source && action.source !== selfName && action.source !== "unknown";
					const row = React.createElement("div", { className: "kpal-action", key: action.id },
						React.createElement("span", { className: "kpal-action-name", key: "n" },
							action.label,
							showSource ? React.createElement("span", { className: "kpal-action-source", key: "s" }, action.source) : null),
						comboChips(combo, "c"),
						isRecording
							? React.createElement("span", { className: "kpal-recording", key: "b" },
								translate("recording"),
								React.createElement("button", { type: "button", className: "kpal-btn", onClick: () => set({ recording: null, error: null }) }, translate("btnCancel")))
							: React.createElement("span", { className: "kpal-action-btns", key: "b" },
								React.createElement("button", { type: "button", className: "kpal-btn", disabled: stateSnap.recording !== null, onClick: () => set({ recording: action.id, error: null }) }, translate("btnRecord")),
								React.createElement("button", { type: "button", className: "kpal-btn", disabled: stateSnap.recording !== null || !combo, onClick: () => set({ bindings: Object.assign({}, stateSnap.bindings, { [action.id]: null }), error: null }) }, translate("btnClear"))));
					rows.push(row);
					if (error) {
						rows.push(React.createElement("div", { className: "kpal-error", key: action.id + "-err" }, error));
					}
				}
				return rows;
			}

			// Reset only the built-in actions to their defaults; bindings for
			// actions registered by other plugins are preserved.
			function resetBindings(bindings) {
				const next = {};
				for (const id of Object.keys(bindings)) {
					if (!(id in DEFAULTS)) next[id] = bindings[id];
				}
				return Object.assign(next, DEFAULTS);
			}

			// ================= floating palette (shell.overlay) =================
			function Palette() {
				const stateSnap = React.useSyncExternalStore(subscribe, getSnapshot);
				const [phase, setPhase] = React.useState("hidden");
				const phaseRef = React.useRef(phase);
				phaseRef.current = phase;

				React.useEffect(() => {
					if (stateSnap.open) {
						if (phaseRef.current !== "shown") setPhase("shown");
					} else if (phaseRef.current === "shown") {
						setPhase("leaving");
						const timer = ctx.get("timer");
						if (timer) {
								const dispose = timer.timeout(() => setPhase("hidden"), 100);
								return dispose;
						}
						setPhase("hidden");
					}
				}, [stateSnap.open]);

				const close = () => set({ open: false, recording: null, error: null });

				// Title row shared by both chrome paths: the settings nav's
				// gear glyph at the same 16px seat, the modal title spec, and
				// the 14px close glyph the settings dialog itself uses.
				const header = React.createElement("div", { className: "kpal-header", key: "h" },
					React.createElement("span", { className: "kpal-title" },
						TitleIcon ? React.createElement(TitleIcon, { size: 16, key: "i" }) : null,
						translate("paletteTitle")),
					React.createElement("button", { type: "button", className: "kpal-close", "aria-label": translate("ariaClose"), onClick: close },
						IconClose ? React.createElement(IconClose, { size: 14 }) : "✕"));

				const sections = [
					...bindingRows(stateSnap),
					React.createElement("div", { className: "kpal-footer", key: "f" },
						React.createElement("span", { className: "kpal-footer-note" }, translate("footerNote")),
						React.createElement("button", { type: "button", className: "kpal-btn", disabled: stateSnap.recording !== null, onClick: () => set({ bindings: resetBindings(stateSnap.bindings), error: null, recording: null }) }, translate("btnReset"))),
				];

				// Preferred chrome: the shared Modal primitive. It ports to
				// document.body over its own blurred mask, renders its own title /
				// close header, handles Escape and mask-click close, and carries
				// the app's hashed CSS — nothing here restyles it except geometry
				// (the primitive's card is 380px wide; the palette rows need 600px
				// and a scroll cap). The className/contentClassName hooks are the
				// primitive's sanctioned extension points for exactly this.
				if (Modal) {
					// headless keeps mask, card, Escape, mask-click close, and
					// the aria-label (title), while the title row above rides
					// inside the card — the primitive's title prop is a plain
					// string seat, so an icon must live in our own header.
					return React.createElement(Modal, {
						open: stateSnap.open,
						onClose: close,
						title: translate("paletteTitle"),
						headless: true,
						className: "kpal-modal-card",
					},
						header,
						React.createElement("div", { className: "kpal-body", key: "b" }, ...sections));
				}

				// Fallback chrome (primitives row absent from the module table):
				// token-level copy of the settings modal chrome. Structure mirrors
					// SettingsRoot: full-viewport overlay with a click-to-close mask,
					// and the dialog panel raised above it.
				if (phase === "hidden") return null;
				return React.createElement("div", { className: "kpal-overlay" + (phase === "leaving" ? " kpal-out" : "") },
					React.createElement("div", { className: "kpal-mask", key: "m", onClick: close }),
					React.createElement("div", { className: "kpal-panel", key: "p", role: "dialog", "aria-label": translate("paletteTitle") },
						header,
						React.createElement("div", { className: "kpal-body" },
							...sections)));
			}
			// ================= settings page (settings.section) =================
			function SettingsPage() {
				const stateSnap = React.useSyncExternalStore(subscribe, getSnapshot);
				return React.createElement("div", { className: "kpal-page" },
					React.createElement("div", { className: "kpal-page-note" },
						translate("settingsNote", { combo: prettyCombo("Mod+/") })),
					...bindingRows(stateSnap),
					React.createElement("div", { className: "kpal-footer" },
						React.createElement("span", { className: "kpal-footer-note" }, translate("settingsFooter")),
						React.createElement("button", { type: "button", className: "kpal-btn", disabled: stateSnap.recording !== null, onClick: () => set({ bindings: resetBindings(stateSnap.bindings), error: null, recording: null }) }, translate("btnReset"))));
			}

			// ================= slots =================
			let slotCleanups = [];
			function mountSlots() {
				const slots = ctx.get("slots");
				if (slots === undefined) return;
				slotCleanups = [
					slots.inject("shell.overlay", () => slots.register(
						{ name: "shell.overlay", id: "keys-palette", order: 100, label: translate("paletteTitle") },
						() => React.createElement(Palette))),
					slots.inject("settings.section", () => slots.register(
						{ name: "settings.section", id: "keys-palette", order: 30, label: translate("settingsPageTitle") },
						() => React.createElement(SettingsPage))),
				];
			}
			mountSlots();
			ctx.effect(() => () => { for (const d of slotCleanups) d(); });
		}

		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
