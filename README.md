# dsh-key-palette-b

> Forked from [DDDPG/dsh-plugins](https://github.com/DDDPG/dsh-plugins)
> (`plugins/dsh-keys-palette`), extracted as a standalone repo and renamed to
> `dsh-key-palette-b`.

Repository: <https://github.com/zeropointnine/dsh-key-palette-b>

A lightweight DSH web plugin that adds a **floating shortcut palette** to the
workspace. Press `Cmd+/` on macOS or `Ctrl+/` elsewhere to view registered
actions and bind key combinations to them. The UI follows DSH's active English
or Chinese locale.

## Installation

With `pnpm` available on `PATH`:

```bash
dsh plugin --profile web add github:zeropointnine/dsh-key-palette-b
```

Restart `dsh` after installation. Append `#<commit-or-tag>` to pin a version.

## Usage

In the browser:

1. Press `Cmd+/` on macOS or `Ctrl+/` elsewhere to open the palette.
2. Press **Record** beside an action, then press your key combination.
3. **Clear** unbinds one action. **Reset defaults** resets only the built-in
   actions; external bindings are preserved.

The same binding UI is available under **Settings → Shortcuts**. Bindings
persist in `localStorage` under `dsh.key-palette-b.v1`.

## Built-in actions

These defaults apply on first use and when **Reset defaults** is pressed. A
saved user binding takes precedence over its default.

| id | label | default |
| --- | --- | --- |
| `new-session` | New Session | `Mod+Shift+Enter` |
| `session-prev` | Previous Session | `Mod+Shift+[` |
| `session-next` | Next Session | `Mod+Shift+]` |
| `toggle-sidebar` | Toggle Sidebar | `Mod+Shift+E` |
| `toggle-right-sidebar` | Toggle Right Sidebar | Unbound |
| `focus-composer` | Focus Composer | Unbound |
| `focus-search` | Focus Session Search | `Mod+Shift+F` |
| `open-workspace` | Open Workspace | Unbound |
| `open-settings` | Open Settings | `Mod+,` |
| `cycle-theme` | Cycle Theme | `Mod+Shift+K` |
| `cycle-locale` | Cycle UI Language | Unbound |

`Mod` means `Cmd` on macOS and `Ctrl` elsewhere. The fixed palette trigger also
accepts a full-width slash: `Mod+／`. Browser- or OS-reserved combinations may
not reach the page and therefore may not work. The `[` and `]` defaults match
the physical bracket keys, so they remain stable across keyboard layouts.

See [docs/hotkeys.md](docs/hotkeys.md) for each built-in action's implementation
and maintenance notes.

### Session previous/next

`session-prev` and `session-next` walk sessions in **recently touched order**,
newest first. Archived, blank, and subagent sessions are skipped. Opening a
session does not itself count as touching it; only durable messages change that
order. The ordering is also frozen for five seconds after each previous/next
press so background activity cannot reorder the list during a burst. The walk
clamps at the oldest and newest sessions instead of wrapping.

## Shortcut extension API

`keys.actions` is a custom client-side action registry published through the
standard DSH/Cordis context service mechanism. It is available to static web
plugins and dynamic Cordis client plugins in the same isolation scope while
this plugin is mounted:

```text
keys.actions
  register(def: { id, label?, description?, source?, run: () => void | Promise<void> }) => disposer
  list(): { id, label, description, source }[]
  subscribe(listener) => unsubscribe
```

```js
// Any DSH web plugin's client half
export function apply(ctx) {
  const keys = ctx.get("keys.actions");
  if (!keys) return;

  const unregister = keys.register({
    id: "my-feature.open-panel",
    label: "Open My Feature",
    source: "my-feature",
    run: () => {
      // Invoke your plugin's behavior here.
    },
  });

  ctx.effect(() => unregister);
}
```

Rules:

- `id` must be stable and globally unique. Duplicate IDs are rejected with a
  console error, and `register()` returns a no-op disposer.
- External plugins should set `source` explicitly so the contributor is
  attributed correctly in the UI.
- Registration is not automatically tied to the contributing plugin's
  lifecycle. Pass the returned disposer to `ctx.effect()` or otherwise call it
  on unload. The entire registry is removed when this plugin unloads.
- The supplied `run` callback can close over the contributing plugin's services
  and state. Synchronous exceptions and rejected promises are logged.
- Registering or unregistering actions never overwrites saved user bindings.
  An action registered without a previously saved binding starts unbound.
- `ctx.get("keys.actions")` returns `undefined` when the service is unavailable;
  the API does not queue registrations or provide a readiness callback.

See [docs/keys-actions.md](docs/keys-actions.md) for the complete JavaScript and
TypeScript integration guide.

## Architecture

- **Service**: `keys.actions` is published through `ctx.provide()`.
- **UI**: the palette mounts in `shell.overlay`; the settings page mounts in
  `settings.section`.
- **Styling**: the palette uses the shared `Modal` primitive from
  `@deepseek-ai/dsh-client-ui-primitives` when available through the shell's
  frozen module table. If it is unavailable, the plugin falls back to local
  chrome built entirely from the global `--dsw-*` design tokens.
- **Dispatch**: one capture-phase `window` `keydown` listener matches bindings
  and invokes actions. Repeated and IME-composition events are ignored.
- **Persistence**: bindings are stored per browser profile in `localStorage`.
- **Localization**: built-in labels and controls follow DSH's active English or
  Chinese locale.

## License

MIT — see [LICENSE](LICENSE).
