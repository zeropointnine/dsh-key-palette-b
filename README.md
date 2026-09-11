# dsh-key-palette-b

> Forked from [DDDPG/dsh-plugins](https://github.com/DDDPG/dsh-plugins)
> (`plugins/dsh-keys-palette`), extracted as a standalone repo and renamed to
> `dsh-key-palette-b`.

A lightweight DSH web plugin that adds a **floating shortcut palette** to the
workspace: press `Cmd+/` (macOS) / `Ctrl+/` (elsewhere) to open it, see what
keys DSH currently uses, and bind your own key combos to common behaviors.
(UI follows the DSH language — zh/en.)

## Usage

```bash
# install into the web profile of a running dsh (npm / bundle channel; latest)
dsh plugin --profile web add dsh-key-palette-b
```

The bundle channel composes at profile boot — it takes effect on the next
`dsh` start. Pick **one** install channel; mixing the bundle channel with a
hot-apply script double-mounts the plugin.

Then, in the browser:

1. Press `Cmd+/` to open the palette.
2. In **Custom bindings**, press Record (录制) on a row, then press your
   combo — done.
3. Clear (清除) unbinds; Reset defaults (恢复默认) resets only the built-in
   actions (external bindings are kept).

The same binding UI is under Settings → Shortcuts (快捷键). Bindings persist
in `localStorage` (`dsh.keys-palette.v1`).

Built-in actions and their defaults:

| id | label | default |
| --- | --- | --- |
| `toggle-sidebar` | Toggle Sidebar (切换侧边栏) | `Mod+Shift+E` |
| `new-session` | New Session (新建会话) | `Mod+Shift+Enter` |
| `session-prev` | Previous Session (上一会话) | `Mod+Shift+[` |
| `session-next` | Next Session (下一会话) | `Mod+Shift+]` |
| `cycle-theme` | Cycle Theme (切换明暗主题) | `Mod+Shift+K` |
| `show-conversation` | Show Conversation (显示会话面板) | — |
| `open-details` / `open-details-fullscreen` / `close-details` | Open docked/fullscreen Details or close it (打开停靠/全屏详情栏或关闭) | — |
| `open-workspace` | Pick, register, and open a Workspace (打开工作区) | — |
| `cycle-locale` | Cycle UI Language (切换界面语言) | — |

`Mod` = `Cmd` on macOS, `Ctrl` elsewhere. Browser-reserved combos (e.g.
`Cmd+S`) never reach the page and can't be bound. `[` / `]` bindings match the
physical bracket keys, so they work the same on any keyboard layout.

### Session prev/next

`session-prev` / `session-next` walk your sessions in **recently-touched
order** (newest first; archived, blank, and subagent sessions are skipped) and
open the neighbor immediately — the sidebar's selected highlight follows for
free. Opening a session does not itself count as "touching" it (only durable
messages do), so the order does not reshuffle while you walk; the walk's
ordering is additionally frozen for **5 seconds after each prev/next press** so
background session activity can't reorder the list mid-burst. The walk clamps
at the oldest/newest session rather than wrapping.

## Standardized shortcut extension

The plugin exposes one public client service, visible to every plugin
(static web plugin or dynamic Cordis plugin) in the same page:

```
keys.actions
  register(def: { id, label?, description?, source?, run: () => void | Promise<void> }) => disposer
  list()  : { id, label, description, source }[]
  subscribe(fn) => unsubscribe
```

```js
// any dsh web plugin's client half
export function apply(ctx) {
  const keys = ctx.get('keys.actions');   // undefined until this plugin is installed
  if (!keys) return;

  const dispose = keys.register({
    id: 'my-feature.open-panel',
    label: 'Open my panel',
    run: () => { /* your behavior */ },
  });
  ctx.effect(() => dispose);              // unregister on unload — your job
}
```

Rules:

- `id` must be unique (built-ins: `toggle-sidebar`, `show-conversation`,
  `open-details`, `open-details-fullscreen`, `close-details`, `new-session`,
  `session-prev`, `session-next`, `open-workspace`, `cycle-theme`,
  `cycle-locale`); duplicates are rejected
  with a console error.
- **Cleanup is the registrant's responsibility**: call the returned disposer
  on unload (`ctx.effect(() => dispose)`). There is no per-registrant fiber
  tracking; the whole registry is removed when this plugin unloads.
- `run` executes in the registering plugin's context, so it can use its own
  services freely.
- User bindings are never overwritten when the action list changes.

## Architecture

- **Service**: `keys.actions` is provided app-wide via `ctx.provide()`.
- **UI**: the palette mounts in the `shell.overlay` slot; the settings page in
  `settings.section`.
- **Dispatch**: a single capture-phase `window` `keydown` listener matches
  combos and runs the bound action.
- **Persistence**: bindings are saved to `localStorage`.

## Development

```bash
node --check lib/client.js lib/index.js
```

Edits to `lib/` are picked up live when installed as a `link:` dependency;
refresh the browser page after changing client code.

Standalone repo — previously part of the
[dsh-plugins](https://github.com/DDDPG/dsh-plugins) collection.

## License

MIT — see [LICENSE](LICENSE).
