---
version: 1
slug: "frontend-admin"
primary_target: "frontend/admin"
related_targets: []
---

# Admin panel (frontend/admin)

Scope: every admin screen: login, studies list, study editor, responses, image library, settings.
Mode: Operate. One non-technical researcher, long laptop sessions, building and rebuilding study forms and judging ad images. Task comes first; she must never wonder where something is.

Direction was pinned by the owner (temporal.io's look, adapted: dark shell, neutral canvas, light/dark toggle), so no direction roll was run.

## Direction contract

THESIS: A study is a run-of-show. The editor draws the form as a timed sequence, with each variant as a solid colour tile, and refuses the Google-Forms default of an undifferentiated stack of white rounded cards on lilac.

OWN-WORLD: Near-black shell (#141414) with square corners everywhere. Light-weight geometric grotesk for headings, monospace for buttons, table heads, section labels and every measured value (ms, px, IDs); field labels stay in the sans, at reading size, for a non-technical reader. Primary actions carry a violet-to-indigo gradient; published and success states are mint; variants are saturated flat tiles (indigo, yellow, mint, coral, orange, violet, magenta). Canvas and image mats are untinted neutral greys so ad colours read true.

STORY: She sees her studies, opens one, understands its sequence and length at a glance, edits a step in place, previews as a participant, publishes, and later watches variants fill evenly and downloads the CSV.

FIRST VIEWPORT: Editor at 1440: 56px dark top bar (wordmark, Studies, Images, Settings, theme, log out). Below it a dark study bar: back, editable title, status, save state, Preview, Publish. Left, a sticky 280px run-of-show rail listing numbered steps with type and duration and the total time. Centre, a 720px column: variant tiles bar, then step cards. Primary action (Publish) top right.

FORM: Standard web app shell with shadcn/ui controls restyled to the world. Signature move: the run-of-show rail plus variant tiles; an aurora-over-grid field appears only on the login screen and the studies header band. seed: none (owner-pinned direction; no roll was run, under reference/new-work.md section 3: "a user- or brief-pinned direction beats the roll, always", and "A session that reaches directions or comps without concept-seed having run (a direction the user or brief pinned) reads the mode's file instead")

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
