# Hotkeys

The palette opens with **`Mod+/`**, meaning `Cmd+/` on macOS and `Ctrl+/`
elsewhere. The equivalent full-width slash form, `Mod+／`, is also accepted.
Every registered action can be bound, rebound, or cleared in the palette or
under **Settings → Shortcuts**.

Built-ins fall into two groups by mechanism: actions that use public DSH client
services and actions that must interact with the DOM because DSH does not expose
a service, event, or route for the behavior. DOM-based actions depend on markup
anchors and should be reverified after relevant DSH UI changes.

## Defaults

| Action | Default |
|---|---|
| `new-session` | `Mod+Shift+Enter` |
| `session-prev` | `Mod+Shift+[` |
| `session-next` | `Mod+Shift+]` |
| `toggle-sidebar` | `Mod+Shift+E` |
| `toggle-right-sidebar` | Unbound |
| `focus-composer` | Unbound |
| `focus-search` | `Mod+Shift+F` |
| `open-workspace` | Unbound |
| `open-settings` | `Mod+,` |
| `cycle-theme` | `Mod+Shift+K` |
| `cycle-locale` | Unbound |

The bracket shortcuts are stored as `Mod+Shift+BracketLeft` and
`Mod+Shift+BracketRight`, so matching uses physical bracket keys across keyboard
layouts. Browser- or OS-reserved combinations may not reach the page.

## Service-based actions

| Action | Mechanism |
|---|---|
| `new-session` | `uiWorkspace.startSession()` starts a session in the current or most recent workspace. |
| `session-prev` / `session-next` | `uiWorkspace.openSession(id)` opens a neighbor in a snapshot ordered through the `sessions` and `workspaces` services. The order remains frozen for five seconds while switching. |
| `toggle-sidebar` | `layout.toggleSidebar()` collapses or expands the left workspace column. |
| `toggle-right-sidebar` | `sidebarRight.toggleExpanded()` expands or collapses the right sidebar. The sidebar owns its presentation state; the layout store is only a downstream synchronization target. |
| `open-workspace` | `uiWorkspace.pickDirectory()`, `workspaces.create()`, and `uiWorkspace.openWorkspace()` implement the directory-picker, registration, and open flow. |
| `cycle-theme` | The theme service cycles `light → dark → system`. |
| `cycle-locale` | The locale service cycles through all installed locales. |

`show-conversation`, implemented with `layout.selectPanel(null)`, remains behind
`FEATURE_SHOW_CONVERSATION = false` and is not registered in the stock action
list. No stock DSH install currently registers a main-slot panel that would make
this action useful.

## DOM-based actions

These actions target component-local UI state that current DSH services cannot
reach:

| Action | Mechanism |
|---|---|
| `focus-composer` | Focuses the Lexical editor root identified by the purpose-built `[data-composer-input]` attribute. |
| `focus-search` | Reads `data-sidebar-collapsed`, expands through `layout.toggleSidebar()` when needed, waits for the 300 ms column transition, then clicks the session-search button identified by its English or Chinese accessible name. |
| `open-settings` | Clicks the sidebar Settings trigger identified by `button[aria-haspopup="dialog"]` and its English or Chinese accessible name. |

If a target is absent because the relevant UI is unavailable or its markup has
changed, the action logs a `[keys-palette]` warning and performs no destructive
operation. If DSH adds public service methods for these behaviors, replace the
DOM interaction in `lib/client.js` with those methods.
