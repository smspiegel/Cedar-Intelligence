# Cedar Intelligence design language

## Purpose

This guide defines the visual language for Cedar's Intelligence workspace and related editorial surfaces. Use it when building or revising pages so the product feels like one operating system rather than a set of separately styled screens.

The language is calm, evidence-led, and alive at the edges. The work stays readable and structured. Forest, glass, and lava are environmental layers that support the content, never decoration that competes with it.

## Core principles

1. **One concentric shape system establishes each workspace.** Corner radii derive from the workspace shape and the measured distance to its corresponding corner. The large desktop reference is a 26px nested-surface radius inside a 26px inset (52px workspace radius), but these are responsive values, not fixed decorations.
2. **Forest is the shared material.** Cards, nested panels, and labelled actions reveal one measured forest field through a scrim. It is never applied as disconnected, repeated decoration.
3. **Writing surfaces stay calm.** Editors, forms, and long reading areas use quartz with bark text, even when their surrounding shell is dark.
4. **Depth comes from layers, not stacks of cards.** Prefer spacing, a divider, or a tonal change to another rounded container.
5. **Motion is ambient.** Lava movement makes each workspace frame feel alive. It must never distract from a decision, an editor, or an action.

## Palette

| Role | Token | Value | Use |
| --- | --- | --- | --- |
| Deep field | `abyss` | `#08201A` | Forest scrims, dark shells, Intelligence surfaces |
| Dark ink | `bark` | `#2A221C` | Light-surface headlines and editable text |
| Warm action | `copper` | `#C77B45` | Standard primary actions and warm emphasis |
| Warm light | `copperLight` | `#E9C88E` | Copper highlights and borders |
| Alert | `rust` | `#A8502A` | Threats, destructive actions, serious status |
| Writing canvas | `quartz` | `#F7F2EA` | Page fallback and high-contrast editors |
| Warm neutral | `sandstone` | `#E8DDCB` | Soft borders and secondary light surfaces |
| Signal | `mint` | `#6EDDB0` | Intelligence labels, active states, forest focus |
| Deep green | `oldGrowth` | `#13382A` | Dark contextual text, sidebar, quiet emphasis |

Use off-white (`quartz`) on forest or dark lava. Use bark or old growth on quartz and other light surfaces. Never place muted gray text over a busy or translucent image without a readable scrim.

## Surface hierarchy

### 1. Intelligence frame

Use one large rounded glass surface for every workspace page.

- Place `LavaBackdrop` behind `LiquidGlassSurface`.
- Keep a fine, pale edge and a restrained sheen.
- Use the lava field only at the outer workspace frame, never behind an individual card or grid.
- Preserve a minimum 24px internal rhythm on desktop and 16px on narrow layouts.

### 2. Forest windows

Use `MirroredForestField` and `IntelligenceSurface` for all nested content surfaces inside a workspace, including findings, priorities, recommendations, and rails.

- Each window reveals the forest at its measured vertical location.
- Maintain the mirrored vertical tiling so long feeds do not produce a hard image-repeat seam.
- Use a dark green scrim with light type for decision surfaces: intelligence, positioning, content selection, recommendations, and contextual rails. Use a translucent moss scrim only for low-emphasis operational lists that retain bark text. Do not leave a bare white panel inside the workspace.
- Use mint for small labels, quartz for headlines on dark forest, and softened off-white for supporting copy.
- A forest window can be a lead card, compact action, operational card, recommendation, or contextual rail. All are windows onto the same field.
- Apply the same calculated corner radii to every visible boundary in a forest window: its outer view, glass mask, image/scrim layer, and content clip. For each corner, calculate `container radius − distance between corresponding corners`, then enforce the responsive content-radius minimum. This keeps nearby curves concentric instead of giving every card the same arbitrary rounded rectangle.

### 3. Editorial composer

Use the hybrid drafting pattern for briefings and other long-form creation flows.

- Wrap the composer in a lava and glass shell.
- Make the context rail a dark forest window with mint labels and off-white copy.
- Keep the actual text editor quartz with bark text and a soft sandstone border.
- Use a forest-styled save or submit button when the action belongs to Intelligence.
- Keep actions, close controls, and approval notices inside the modal's dark chrome, not on a detached white footer.

### 4. Standard product pages

Pages outside Intelligence sit inside the shared lava and glass workspace frame, using forest-window content cards with quartz reading scrims for operational work.

- Reuse the shared workspace frame for Monitor, Context, Settings, and general management pages.
- Do not add a second lava or glass frame within those pages.
- Use a translucent moss scrim over the shared forest for forms, settings, and dense operational information. Keep quartz only for editable text fields and long-form writing canvases.
- Never add a separate forest crop to a nested surface. Its forest position comes from the workspace field.

## Typography

| Context | Treatment |
| --- | --- |
| Intelligence title and section heading | Bark or old growth over the pale lava field; avoid white text unless it sits over a dark scrim |
| Forest-card headline | Quartz, 700 weight, compact line-height |
| Forest-card support text | Soft off-white, never gray |
| Mint label | All caps, 10.5px, 800 weight, approximately 0.8px tracking |
| Light-surface heading | Bark, 600 to 700 weight |
| Light-surface body | Bark or the existing dark neutral text token |
| Metadata over a forest | Pale green or off-white with sufficient contrast |

Keep body copy at 12.5 to 13.5px with 18 to 20px line-height. Keep heading line-height tight. The typeface remains Manrope across all page types.

## Layout and shape

- Use 8px as the working spacing increment. Prefer gaps of 8, 12, 16, 24, and 32px.
- The desktop reference uses a 26px nested-surface radius and a 26px workspace inset, producing a 52px workspace radius. On compact layouts, reduce both values together (currently a minimum 18px surface radius plus a 16px inset). Do not bind a radius directly to viewport width; derive it from the measured workspace container, whose compact padding responds to available width.
- For each surface corner, calculate `container radius − Euclidean distance between that surface corner and the corresponding workspace corner`, clamped between the responsive surface minimum and the local geometry limit. This is Cedar's cross-platform equivalent of Apple's container-concentric behavior. A surface far from a workspace corner uses the minimum radius; a surface close to one follows the outer curve. Apply the same four calculated values to all of its clips and material layers.
- Controls, input fields, chips, and avatars can use their own smaller radii because they are not workspace surfaces.
- Use one panel at each hierarchy level. A card inside a card requires a functional reason, such as a writable editor inside an editorial shell.
- On screens below 700px, stack side-by-side content, priority windows, and composer rails vertically.
- Preserve a clear visual path: page title, priority content, section label, then feed or workspace.
- Do not use full-width rules to decorate section boundaries. Keep dividers only for repeated rows, tab orientation, chart axes, and modal header or footer separation. Use a deep green line, never a pale sandstone rule.

## Motion and interaction

- Lava blobs move slowly with transform-only drift and breathing. Keep all cycles ambient and continuous.
- Use movement to communicate a living Intelligence environment, never loading progress or urgency.
- Buttons reveal the shared forest crop with a dark scrim and off-white text. Primary actions add a restrained copper scrim; destructive actions add a rust scrim.
- Keep existing press, hover, focus, disabled, loading, error, and success behavior when restyling controls.

## Implementation recipes

### Intelligence page

1. Render `<Page>`.
2. Place the header, priority windows, section label, and finding grid directly inside the frame.
3. Let the workspace-level `MirroredForestField` provide the shared crop to every `IntelligenceSurface`, `Card`, and `Button`.
4. Do not introduce another grid, banner, page frame, or independently cropped forest image around those surfaces.

### Forest action

1. Use `<Button>` for a labelled action inside the workspace.
2. Let it measure itself against the workspace forest field rather than applying its own crop.
3. Apply the supplied dark, copper, or rust scrim, quartz label, and mint hover edge.

### Drafting surface

1. Use `LavaBackdrop` and `LiquidGlassSurface` for the modal shell.
2. Pass `fill` to `LiquidGlassSurface` when the shell has a fixed height.
3. Add the forest context rail and preserve the light editor as the only light canvas inside the modal.
4. On narrow viewports, stack the rail before the editor and preserve editor flex space.

## Review checklist

Before shipping a page that uses this language, confirm:

- There is no unnecessary nested frame or card stack.
- Every card, scrim, and glass mask shares its calculated four-corner concentric geometry; the enclosing workspace uses its responsive derived radius.
- Every nested card, rail, recommendation, and labelled button uses the same forest field rather than a flat or separately cropped fill.
- Light text over imagery sits on a sufficiently dark scrim.
- Long-form text is edited and read on a light, high-contrast canvas.
- Mint indicates Intelligence, selection, or focus. It is not used as a general decorative fill.
- Lava is confined to outer workspace and editorial shells, never nested card-level surfaces.
- The narrow layout stacks cleanly and preserves all actions.
- The page passes lint, TypeScript, and web build checks.

## Source of truth

The current implementation lives in `frontend/src/app/index.tsx` and its shared glass primitive lives in `frontend/src/liquid-glass-surface.*`. Update this guide whenever a reusable visual rule, primitive, or token changes.
