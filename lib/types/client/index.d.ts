/**
 * dsh-key-palette-b — client half types.
 *
 * Public extension surface (documented in README.md): the plugin publishes one
 * client service, `keys.actions`, visible to every plugin in the same page.
 * Consume it with `ctx.get('keys.actions')` (returns `undefined` until the
 * palette plugin is installed) and register bindable behaviors:
 *
 * ```ts
 * const keys = ctx.get('keys.actions') as KeysActionsService | undefined
 * if (!keys) return
 * keys.register({
 *   id: 'my-feature.open-panel',
 *   label: '打开我的功能面板',
 *   description: '由 my-feature 提供',
 *   run: () => { /* execute the behavior *\/ },
 * })
 * ```
 *
 * Registered actions appear automatically in the floating palette
 * (Cmd+/) and in Settings → 快捷键, where users bind key combinations.
 */

/** One bindable behavior contributed to the registry. */
export interface KeysActionDefinition {
  /** Unique id across all registered actions (including the built-ins). */
  id: string;
  /** Display label in the palette / settings rows. Falls back to `id`. */
  label?: string;
  /** Optional short description. */
  description?: string;
  /** Optional contributor name; external plugins should set it explicitly. */
  source?: string;
  /** Callback supplied by the contributor; it may close over plugin state. */
  run: () => void | Promise<void>;
}

/** Read-only view of a registered action (no `run`). */
export interface KeysActionView {
  id: string;
  label: string;
  description: string;
  source: string;
}

/**
 * The `keys.actions` client service.
 *
 * - `register` rejects duplicate ids with a console error and returns a
 *   no-op disposer. The returned disposer unregisters the action — call it
 *   when your plugin unloads (e.g. `ctx.effect(() => dispose)`). There is no
 *   per-registrant fiber tracking; the whole registry (and every action in
 *   it) is removed when dsh-key-palette-b itself is unloaded.
 * - `list` returns a snapshot of the current actions.
 * - `subscribe` notifies on any registration change; returns an unsubscribe.
 */
export interface KeysActionsService {
  register(def: KeysActionDefinition): () => void;
  list(): KeysActionView[];
  subscribe(fn: () => void): () => void;
}
