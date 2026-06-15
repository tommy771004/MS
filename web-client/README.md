# 🍁 楓之谷 Clone — PixiJS + React 雙層架構 Spike

A standalone proof-of-concept for the recommended **two-layer architecture**: a
**PixiJS (WebGL) game layer** + a **React/Zustand (DOM) UI layer**, bridged by a single
store. It exists alongside (and does not touch) the Phaser game in [`../src/`](../src/).

> ⚠️ Educational / research use only. All art is generated at runtime via
> `PIXI.Graphics` — no copyrighted assets.

## Why two layers?

Building inventory grids, chat, and HP bars *inside* a canvas is painful. So:

- **DOM layer (React + Zustand):** all UI — HP/MP/EXP bars, inventory, chat, and
  **DOM-rendered damage numbers**. State lives in a Zustand store.
- **WebGL layer (PixiJS v8):** map rendering, the **paper-doll `PIXI.Container`**
  character, monster animation, parallax, and **foothold** terrain collision.

The two never call each other directly — they meet at the store
([`src/store/gameStore.ts`](src/store/gameStore.ts)): the game writes discrete results
(damage, HP/EXP, chat) and React renders them.

## Run

```bash
npm install
npm run dev        # http://localhost:5174
npm run build      # tsc --noEmit + vite build
npm run typecheck
```

## Controls

| Action | Keys |
| --- | --- |
| Move | `←` `→` |
| Jump | `Space` |
| Attack | `X` / `Ctrl` |
| Drink HP / MP potion | `1` / `2` (or click the inventory) |
| Toggle inventory | `I` |
| Chat | click the box, type, `Enter` |

## What it demonstrates

**PixiJS game layer** ([`src/game/`](src/game/))
- **Paper-doll `Container`** ([`Character.ts`](src/game/Character.ts)): Pants → Coat → Head →
  Hair → (Arm + Weapon) layered as Sprites; flip/animate the outer container and every
  part follows — exactly the "紙娃娃疊加結構" the architecture calls for.
- **Foothold terrain collision** ([`Foothold.ts`](src/game/Foothold.ts)): walk on line
  segments (incl. slopes + floating platforms), not box colliders — the MapleStory model.
- **Multi-layer parallax** via `TilingSprite` ([`Parallax.ts`](src/game/Parallax.ts)).
- **Batch rendering**: monsters and ground tiles are Sprites from shared textures, so they
  batch into few draw calls ([`textures.ts`](src/game/textures.ts)).
- Server-style combat resolution (the game decides damage, then reports it to the store).

**React DOM UI layer** ([`src/ui/`](src/ui/))
- [`Hud`](src/ui/Hud.tsx) HP/MP/EXP bars, [`Inventory`](src/ui/Inventory.tsx),
  [`Chat`](src/ui/Chat.tsx), and [`DamageLayer`](src/ui/DamageLayer.tsx) (DOM damage numbers).
- Keyboard input is ignored while a DOM input is focused, so chat typing never leaks into
  the game — a concrete payoff of the split.

## Relationship to the rest of the repo

This is a *rendering-architecture spike*, intentionally separate from the production
Phaser client in [`../src/`](../src/) and the authoritative server in [`../server/`](../server/).
It shows how a PixiJS + DOM-UI front end would be structured if the project migrated off
Phaser; nothing here is wired to the server yet.
