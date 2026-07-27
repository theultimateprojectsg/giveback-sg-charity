# add_dashboard_card_order migration

Applied via mcp__supabase__apply_migration.

## What changed
`charity_contacts` gained `dashboard_card_order` (jsonb, default `{}`).

## Why
Following the show/hide customize feature, charities also want to reorder cards
within a Dashboard section (drag-and-drop), not just hide them. Stores
`{ [sectionId]: string[] }` — an ordered array of card keys per section
(`fo`, `fp`, `cp`, `ma`, `pp`, `rc`, `gr`, `db`), read/written via
`reorderDashboardCard` in `App.tsx` using the same race-safe
`updateCharityJsonField` pattern as `dashboard_hidden_cards`.

Drag-and-drop itself is native HTML5 DnD (no new library) via a shared
`DraggableCard` component in `AnalyticsPage.tsx`. Rather than physically
reordering JSX children, each card gets a CSS `order` value computed from
the saved order (falling back to the section's default definition order),
so visual reordering happens purely through CSS `order` on a
`display:flex; flexWrap:wrap` container — this also fixes the earlier
blank-space-when-hidden problem for free, since flex-wrap reflows
naturally when a card is hidden or reordered (unlike a fixed
`grid-template-columns` count).

Rollout only reached Financial Overview and Fundraising Performance in
this pass; the remaining five sections (Campaign Performance, Mass
Appeals, Pledge Performance, Recurring Donations Performance, Grants
Overview, Donor Behavior & Retention) still use the old fixed-grid layout
without drag-and-drop, and are the next piece of this feature.

Verified in the browser: dispatched real HTML5 DragEvents (dragstart →
dragover → drop) between two Financial Overview cards, confirmed the DB
row's `dashboard_card_order.fo` updated to the new order and each card's
computed CSS `order` matched it after a fresh reload.
