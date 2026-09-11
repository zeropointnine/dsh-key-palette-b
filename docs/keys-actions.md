# Adding shortcut actions from another plugin

This guide is for DSH plugin authors who want to expose a behavior in the key
palette and let users assign a keyboard shortcut to it.

## What `keys.actions` is

`keys.actions` is a client-side service provided by `dsh-key-palette-b`. It is
not a browser API or a built-in DSH command system. The plugin publishes its
custom action registry through the standard DSH/Cordis context service
mechanism:

```js
ctx.provide("keys.actions", registry);
```

Other plugins obtain that registry with `ctx.get("keys.actions")` and register
their actions. Registered actions automatically appear in the **Cmd+/** palette
(**Ctrl+/** on non-macOS platforms) and in **Settings → Shortcuts**.

## Minimal integration

Register from the client half of your plugin:

```js
export function apply(ctx) {
  const keys = ctx.get("keys.actions");
  if (!keys) return;

  const unregister = keys.register({
    id: "my-feature.open-panel",
    label: "Open My Feature",
    description: "Open the My Feature panel",
    source: "my-feature",
    run: () => {
      // Invoke your plugin's behavior here.
    },
  });

  // Registration is not automatically tied to your plugin's lifecycle.
  ctx.effect(() => unregister);
}
```

The action is initially unbound unless a binding for the same action ID was
previously saved in this browser. The user can select **Record** beside the
action and enter a combination.

## TypeScript

The client type package exports the service and action interfaces:

```ts
import type {
  KeysActionsService,
  KeysActionDefinition,
} from "dsh-key-palette-b/client";

export function apply(ctx: any) {
  const keys = ctx.get("keys.actions") as KeysActionsService | undefined;
  if (!keys) return;

  const action: KeysActionDefinition = {
    id: "my-feature.open-panel",
    label: "Open My Feature",
    description: "Open the My Feature panel",
    source: "my-feature",
    run: async () => {
      // Async actions are supported.
    },
  };

  const unregister = keys.register(action);
  ctx.effect(() => unregister);
}
```

## Action definition

`register()` accepts the following fields:

| Field | Required | Meaning |
|---|---:|---|
| `id` | Yes | Stable, globally unique action identifier. |
| `run` | Yes | Function invoked when the assigned shortcut is pressed. It may return a promise. |
| `label` | No | User-facing name. Defaults to `id`. |
| `description` | No | Metadata returned by `list()`. The current palette and settings rows do not display it. |
| `source` | No | Contributor name shown for external actions. External plugins should always set it explicitly. |

Use a namespaced ID such as `plugin-name.action-name`. IDs shared with built-in
or other plugin actions are rejected, and `register()` returns a no-op disposer
in that case.

Treat an action ID as persistent public data. Bindings in `localStorage` are
stored by ID, so renaming an ID loses the connection to the user's existing
binding. Conversely, unregistering an action does not delete its binding: if
that ID is registered again later, the binding becomes active again.

The current fallback for an omitted `source` is the palette service's own fiber
name, not the calling plugin's name. External plugins should therefore provide
`source` to receive correct attribution in the UI.

## Using your own plugin context

The registry invokes the supplied `run` callback directly. Because your plugin
creates that callback, it can close over your own services and state:

```js
export function apply(ctx) {
  const keys = ctx.get("keys.actions");
  const panels = ctx.get("my-feature.panels");
  if (!keys || !panels) return;

  const unregister = keys.register({
    id: "my-feature.toggle-panel",
    label: "Toggle My Feature panel",
    source: "my-feature",
    run: () => panels.toggle(),
  });

  ctx.effect(() => unregister);
}
```

The registry catches synchronous exceptions and rejected promises from `run`
and reports them in the browser console. It does not display action failures in
the UI, so an action should provide its own user feedback when appropriate.

## Service availability

`ctx.get("keys.actions")` returns `undefined` when `dsh-key-palette-b` is not
installed or has not mounted yet. The registry API itself does not queue
registrations or provide a readiness callback.

For a required integration, declare `"keys.actions"` in the client plugin's
`inject` list so Cordis waits for the provider. For an optional integration,
use `ctx.get()` with an undefined check as in the examples above. The registry
does not become available later to a plugin that already returned after an
unsuccessful optional lookup, so do not assume every DSH installation includes
this plugin.

## Cleanup

Always retain and call the disposer returned by `register()`:

```js
const unregister = keys.register(definition);
ctx.effect(() => unregister);
```

The registry does not track the registering plugin's lifecycle. Without cleanup,
a dynamically unloaded plugin can leave behind an action whose callback closes
over stale state. Call each returned disposer once; do not retain an old
disposer after registering the same ID again. All registrations disappear when
`dsh-key-palette-b` itself unloads.

## Reading and observing the registry

Most plugins only need `register()`, but the service also exposes read and
subscription operations:

```ts
interface KeysActionsService {
  register(definition: KeysActionDefinition): () => void;
  list(): KeysActionView[];
  subscribe(listener: () => void): () => void;
}
```

`list()` returns a snapshot containing `id`, `label`, `description`, and
`source`; executable callbacks are deliberately omitted. `subscribe()` invokes
the listener synchronously when an action is registered or unregistered and
returns an unsubscribe function. Subscription listeners must not throw.

```js
const unsubscribe = keys.subscribe(() => {
  console.log(keys.list());
});

ctx.effect(() => unsubscribe);
```

## Shortcut behavior and limitations

- The palette trigger is fixed at **Cmd+/** on macOS and **Ctrl+/** elsewhere;
  the equivalent full-width slash form is also accepted.
- User action bindings must include Ctrl, Cmd/Meta, or Alt when recorded.
- While recording, the UI rejects a combination already assigned to another
  currently registered action. Persisted duplicates are not normalized; if one
  exists, the first registered matching action runs.
- Dispatch uses one capture-phase `window` `keydown` listener.
- A matched event has `preventDefault()` called before the action runs.
- Repeated and IME-composition key events are ignored.
- Browser- or operating-system-reserved combinations may never reach the page;
  for example, a browser may consume **Cmd+S** first.
- Bindings are local to the current browser profile and are stored under
  `dsh.key-palette-b.v1` in `localStorage`.
- Resetting shortcuts restores built-in defaults but preserves bindings for
  actions contributed by other plugins.

## Complete JavaScript example

```js
export function apply(ctx) {
  const keys = ctx.get("keys.actions");
  if (!keys) {
    console.info("[my-feature] key palette is unavailable");
    return;
  }

  const unregisterOpen = keys.register({
    id: "my-feature.open",
    label: "Open My Feature",
    description: "Open the feature's main view",
    source: "my-feature",
    run: () => {
      const feature = ctx.get("my-feature");
      if (!feature) return;
      feature.open();
    },
  });

  const unregisterRefresh = keys.register({
    id: "my-feature.refresh",
    label: "Refresh My Feature",
    description: "Reload data in the feature view",
    source: "my-feature",
    run: async () => {
      const feature = ctx.get("my-feature");
      if (!feature) return;
      await feature.refresh();
    },
  });

  ctx.effect(() => () => {
    unregisterOpen();
    unregisterRefresh();
  });
}
```
