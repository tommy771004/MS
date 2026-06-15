# 🍁 楓之谷 Clone — MapleStory-style 2D RPG Prototype

A single-player, browser-playable prototype of a MapleStory-style 2D side-scrolling
RPG, built with **TypeScript + Phaser 3 + Vite**. It implements Phases 1–3 of the
roadmap in [`design.md`](./design.md): platforming, combat, and core RPG systems.

> ⚠️ **For educational / research use only.** No official MapleStory assets are used.
> Every sprite is generated procedurally at runtime ([`PreloadScene`](./src/scenes/PreloadScene.ts)),
> so you can swap in your own/free art later without touching game logic.

## Quick start

```bash
npm install
npm run dev        # opens http://localhost:5173
```

Other scripts:

```bash
npm run build      # type-check (tsc --noEmit) + production build to dist/
npm run preview    # serve the production build
npm run typecheck  # types only
```

## Controls

| Action | Keys |
| --- | --- |
| Move | `←` `→` |
| Jump (hold = higher) | `Space` / `Alt` |
| Attack | `Ctrl` / `X` |
| Prone | `↓` |
| Drop through one-way platform | `↓` + jump |
| Climb ladder/rope | `↑` / `↓` near a ladder |
| Drink HP / MP potion | `1` / `2` |
| Skills (Power Strike / Slash Blast) | `A` / `S` |
| Talk to NPC / open shop | `Z` (walk up to the merchant) |
| Toggle inventory | `I` |
| Close shop | `Esc` |

## What's implemented

**Phase 1 — Platforming** ([`Player`](./src/entities/Player.ts))
- Floaty MapleStory-style gravity & **variable-height jump** (jump-cut on release).
- **One-way platforms**: jump up through them, `↓`+jump to drop down.
- Ladder/rope **climbing**.
- Strict **finite state machine** (`idle → walk → jump → prone → attack → climb`),
  see [`StateMachine`](./src/entities/StateMachine.ts).
- **Paper-doll avatar**: torso / head / arm+weapon as separate layered parts; the
  weapon swings from the arm anchor on attack (design.md §2.2).

**Phase 2 — Combat** ([`GameScene`](./src/scenes/GameScene.ts), [`Monster`](./src/entities/Monster.ts))
- Patrolling **dummy monsters** with floating HP bars.
- Attack **hitbox** resolution, hit flash, knockback, monster i-frames.
- **Object-pooled damage numbers** (no per-hit allocation), with crits
  ([`DamageNumbers`](./src/systems/DamageNumbers.ts), design.md §2.3).
- Monster **death + loot drops** (mesos / potions / equips) you walk over to collect.

**Phase 3 — RPG systems**
- Centralized [`StatManager`](./src/systems/StatManager.ts): STR/DEX/INT/LUK,
  derived HP/MP/attack/accuracy, **EXP & leveling**.
- MapleStory-style **damage formula** ([`DamageFormula`](./src/systems/DamageFormula.ts), design.md §3.1).
- Tabbed [`Inventory`](./src/systems/Inventory.ts) (EQUIP/USE/ETC/SETUP/QUEST),
  stacking, equipping, potions.
- NPC [`Shop`](./src/systems/Shop.ts) (design.md §3.2, docs/phase5.md 階段六): walk up to
  the merchant ([`Npc`](./src/entities/Npc.ts)) and press `Z` to **buy/sell** items;
  transactions are validated against mesos and bag space, with prices driven from
  [`shops.json`](./src/data/shops.json) + each item's `buyPrice`/`sellPrice`.
- [`SkillSystem`](./src/systems/SkillSystem.ts): **active** (cooldown + MP),
  **passive** (folded into stats), **buff** (timed) skills.
- HUD ([`UIScene`](./src/scenes/UIScene.ts)): HP/MP/EXP bars, quick slots with
  cooldown sweeps, buff icons, **minimap**, and a clickable inventory window.
- **Multi-layer parallax** background ([`ParallaxBackground`](./src/world/ParallaxBackground.ts)).

## Data-driven design (design.md §6)

All balance numbers live in JSON, loaded at startup — no values are hard-coded in
gameplay scripts:

- [`src/data/items.json`](./src/data/items.json) — item database (incl. buy/sell prices)
- [`src/data/monsters.json`](./src/data/monsters.json) — monster stats & drop tables
- [`src/data/skills.json`](./src/data/skills.json) — skill definitions
- [`src/data/shops.json`](./src/data/shops.json) — NPC shop catalogues
- [`src/world/level.ts`](./src/world/level.ts) — level geometry, monster & NPC spawns
- [`src/config.ts`](./src/config.ts) — physics & combat "feel" constants

## Project layout

```
src/
  main.ts                 # Phaser game config & scene registration
  config.ts               # tunable constants (physics, combat, palette)
  types.ts                # shared data contracts
  data/                   # JSON content + typed registry (items, monsters, skills, shops)
  entities/               # Player (FSM), Monster, Npc, StateMachine
  systems/                # StatManager, Inventory, Shop, SkillSystem, DamageNumbers, DamageFormula
  world/                  # level layout, parallax background
  scenes/                 # Boot → Preload (texture gen) → Game + UI
```

## Not implemented (future work)

Phase 4 (multiplayer): authoritative Node.js socket server, packet/OpCode design,
and interest management (AOI) as outlined in design.md §4. The single-player combat
is already resolved in one place (`GameScene.resolveMelee`) to make moving it
server-side later straightforward.
