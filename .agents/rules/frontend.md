---
paths:
  - "frontend/**"
---

# Frontend Conventions

Two separate apps with different goals. Do not share code between them beyond API types.

| App | Goal | Stack |
|---|---|---|
| `frontend/admin/` | Friendly, polished editor for a non-technical user | React, TypeScript, Tailwind, shadcn/ui, dnd-kit, TanStack Query, React Router, Tiptap |
| `frontend/participant/` | Neutral, precise, distraction-free runtime | TypeScript, jsPsych, plain CSS |

---

## Both apps

- TypeScript strict mode. No `any`; use `unknown` and narrow.
- API response and request types live in one `api/types.ts` per app and mirror the backend schemas.
- All requests go through one small `api/client.ts`. No `fetch` scattered in components.
- Coordinates on images are always normalised 0–1 relative to the displayed image, top-left origin.

---

## Admin

- Use shadcn/ui components. Do not hand-build a button, dialog, dropdown, toast, table, tabs or form control.
- Drag and drop uses dnd-kit, including keyboard sensors.
- Design tokens come from `DESIGN.md` and the Tailwind theme. No one-off hex values in components.
- Run the `impeccable` skill for any new screen or visual change.
- Server state lives in TanStack Query. No copy of server data in component state except the editor's in-progress draft.
- Autosave is debounced and shows its state: saving, saved, or failed with a retry.
- Destructive actions (delete form, delete response, clear responses, full wipe) need a confirmation dialog that names what will be lost.
- When a form is published, structural controls are disabled and say why. The backend enforces the same rule; the UI only mirrors it.
- Wording is for a non-technical reader: "Publish", "Copy link", "Responses". No "slug", "payload" or "entity".

---

## Participant

- **Nothing loads from another origin.** jsPsych and every plugin come from npm and are bundled. No CDN script, web font, analytics or remote image. System font stack only.
- Neutral greys and one quiet accent. No brand colour, animation or decoration that could pull attention from the stimulus.
- A stimulus image always fits the visible viewport without scrolling: size against `100dvh` / `100dvw` with `object-fit: contain`.
- Preload every image before the first timed step starts.
- Reaction time is measured with `performance.now()` from the frame the image is painted, never from when the request was sent.
- Record `pointerType` with every click.
- Before a timed step renders, tell the server it has started. That is what prevents a replay after refresh.
- The session ID is kept in `sessionStorage`. The only `localStorage` entry is the "already took part" flag. No cookies.
- "Data we collect" and "Leave study" are reachable from every screen, except while a timed stimulus is on screen.
- Preview mode never calls a write endpoint.

---

## Checks

`npm run lint`, `npm run typecheck` and `npm run build` pass for the app you changed. Look at UI changes in a browser at a phone width and a laptop width.
