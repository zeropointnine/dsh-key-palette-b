# Hotkeys

The palette itself opens with **`Mod+/`** (⌘/ or Ctrl+/). Every action below
can be bound, rebound, or cleared in the palette.

Built-ins fall into two buckets by *mechanism*: those that act through the
public DSH plugin API (`ctx.get(<service>)` faces), and those that must reach
into the DOM because no API exists for what they do. The split matters for
maintenance: API-based actions keep working across DSH UI churn; DOM-based
ones depend on markup anchors and should be re-verified when DSH ships
visual changes.

## API-based

| Action | Mechanism |
|---|---|
| `toggle-sidebar` | `layout.toggleSidebar()` — collapse/expand the left workspace column. |
| `toggle-right-sidebar` | `sidebarRight.toggleExpanded()` — expand/collapse the right sidebar (DSH's current name for the column; "Details" was the pre-rework nomenclature). The right sidebar owns its presentation state; the layout store is only a downstream sync target, so the `sidebarRight` service is the correct face. |
| `new-session` | `uiWorkspace.startSession()` — new session in the current (or most recent) workspace. |
| `session-prev` / `session-next` | `uiWorkspace.openSession(id)` over an ordering snapshot from the `sessions`/`workspaces` services (recency walk, order frozen 5s while switching).
| `open-workspace` | Directory-picker flow + workspace registration through the workspace services. |
| `cycle-theme` | Theme service snapshot + write (light → dark → system). |
| `cycle-locale` | Locale service snapshot + write (en ↔ zh). |

`show-conversation` (`layout.selectPanel(null)`) also exists in the code but
is hidden behind `FEATURE_SHOW_CONVERSATION = false`: no stock DSH install
registers a main-slot panel (Settings is a modal), so it is an invisible
no-op today. Flip the flag if third-party full-page panels appear.

## DOM interaction required

These actions target UI whose open/focus state is component-local React
state inside DSH packages — no provided service, no event, no route can
reach it. The only lever a plugin holds is the DOM: locate a real button and
click it. Both locate their target by localized accessible name (`aria-label`),
which works because DSH ships only `en`/`zh` dictionaries.

| Action | Mechanism |
|---|---|
| `open-settings` | Clicks the sidebar-foot Settings trigger (`button[aria-haspopup="dialog"]` whose `aria-label` is "Settings"/"设置"; the role hint disambiguates it from chat usage pills). The modal's open state is `useState` inside ui-settings-general's `SettingsRoot`. |
| `focus-search` | Two-phase. **Expand:** reads `data-sidebar-collapsed` off the frame (asserted by DSH's own e2e suite, so near-contractual) to decide whether the *blind* public `layout.toggleSidebar()` should fire. **Focus:** after a 300 ms wait — matching `EXPAND_SLIDE_MS`, the same delay DSH's own `searchOnExpand` effect uses, since the wide-mode search button only mounts once the column is wide — clicks that button ("Search sessions"/"搜索会话"). If already expanded, toggle and delay are skipped and the click is idempotent (re-focus). |
| `focus-composer` | The minimal reach-out: the chat composer is a Lexical editor with an internal-only focus path, but its contenteditable root carries a purpose-built `data-composer-input` attribute. One query + one `.focus({ preventScroll: true })` — literally what DSH's own InputBar does; Lexical's native-focus listener restores the selection. No timing, no state reads, no locale-dependent selectors. |

Failure modes are loud, not silent: if the anchors drift (DSH restyles or
renames a trigger), the actions warn in the console tagged `[keys-palette]`
and do nothing destructive. If DSH ever ships real `openSettings()` /
`focusSearch()` faces, the run bodies are one-line swaps — see the
`NECESSARY DOM REACH-OUT` comments in `lib/client.js`.
