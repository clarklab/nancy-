# Integration defects

Found by manual smoke testing against `smoke.html` while the subsystem agents
were still in flight. Each needs fixing during the integration pass.

## 1. `.overlay-root` blanket rule blocks all scene input — CRITICAL — FIXED

Fixed by the `hud` review agent, which removed the blanket rule and made the
overlay layer inert by default. Re-verified: hover and click both reach the
scene, and the interior-voice line renders correctly.

<details><summary>Original report</summary>


`src/styles/base.css:283`

```css
.overlay-root > *:not(.hud) {
  pointer-events: auto;
}
```

Specificity `(0,2,0)` beats `.narration-root { pointer-events: none }` in
`narration.css` `(0,1,0)`, so the narration layer swallows every pointer event
across the whole stage. No hotspot can be hovered or clicked — the game is
unplayable.

**Fix:** wrap the blanket default in `:where()` so it contributes zero
specificity and each overlay module keeps authority over its own layer:

```css
:where(.overlay-root > *:not(.hud)) {
  pointer-events: auto;
}
```

Verified as the cause: injecting
`.narration-root:not(.is-active){pointer-events:none !important}` restores
hover and click.
</details>

## 2. Hover affordance reads as a hard rectangle

The hover state on a `rect` hotspot draws a visible axis-aligned box with sharp
corners. Against a painted scene it looks like a debug overlay rather than an
in-world highlight. It should be predominantly a soft radial bloom with the
ring either dropped or feathered to near-invisibility at the corners.

## 3. `Hud` API drift vs. `game.ts` — RESOLVED

The `hud` review agent converged the module onto the orchestrator's contract on
its own: `HudCallbacks` now has the five separate handlers plus an optional
`onSound`, `toast(kind, title, icon?)` takes three arguments, and
`announceLocation(name, subtitle?)` exists. `game.ts` typechecks against it
unchanged. Original report below for the record.

<details><summary>Original report</summary>


`src/ui/hud.ts` landed with a different (better) callback shape than the
orchestrator assumes:

- has `onPanel(panel)`; `game.ts` passes `onOpenJournal` / `onOpenInventory` /
  `onOpenMap` / `onHint` / `onMenu`
- `toast(kind, id)` takes 2 args; `game.ts` calls it with 3
- no `announceLocation(name, subtitle)` — `game.ts` calls it on every scene change
- no `onSound` callback in `HudCallbacks`

Reconcile in `game.ts` (adopt the HUD's API — it is the cleaner design) and add
`announceLocation` to the HUD.
</details>

## 4. `import.meta.env` needed `vite/client` types

Fixed: added `"types": ["vite/client"]` to `tsconfig.json`.

## 5. Journal: generated material textures are not wired in

`public/art/ui/` now contains real generated materials — `tex-parchment.webp`,
`tex-leather.webp`, `tex-corkboard.webp`, `seal-wax.webp`, `frame-brass.webp`,
`plate-slot.webp`. The journal currently builds its paper and leather from CSS
gradients alone, which reads as flat cream rather than aged stock. Wire the
textures in as `background-image` layers under the existing gradients
(multiply/overlay blend, low opacity) so the surfaces have real grain.

## 6. Journal: two-page spread only uses the left page

On the Clues tab every card stacks in a single narrow column on the left page
while the entire right page sits empty. The card measure is roughly 30
characters, which is far too tight for the summary prose. Cards should flow
across both pages in a multi-column layout, with a wider measure.

## 7. Journal: the "unread" marker reads as a red button

The wax-seal marker on each new clue card renders as a flat red circle
overlapping the card's bottom-right corner. It should use `seal-wax.webp` and
sit at the top edge of the card as if pressed into it.
