import { create } from 'zustand';

/**
 * The bridge between the two layers (design: DOM UI ↔ WebGL game).
 *
 * The PixiJS game layer WRITES gameplay state here (HP/MP/EXP changes, spawned
 * damage numbers, chat) via `useGameStore.getState()`, and the React DOM layer
 * READS it via hooks. Per-frame data (player x/y, camera) deliberately stays in
 * the Pixi layer to avoid re-rendering React every frame — only discrete state
 * changes flow through the store.
 */

export interface PlayerStats {
  level: number;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  exp: number;
  expMax: number;
}

export interface InventoryItem {
  id: number;
  name: string;
  /** Placeholder icon color (hex). */
  color: number;
  qty: number;
  kind: 'potion-hp' | 'potion-mp' | 'etc';
  heal?: number;
}

export interface ChatMessage {
  id: number;
  author: string;
  text: string;
  system?: boolean;
}

/** A floating damage number rendered as a DOM element (screen coords). */
export interface DamageNumber {
  id: number;
  sx: number;
  sy: number;
  amount: number;
  crit: boolean;
  kind: 'enemy' | 'player';
}

interface GameState {
  player: PlayerStats;
  inventory: InventoryItem[];
  chat: ChatMessage[];
  damage: DamageNumber[];
  inventoryOpen: boolean;

  // --- mutations called from either layer ---
  patchPlayer: (p: Partial<PlayerStats>) => void;
  healHp: (amount: number) => void;
  healMp: (amount: number) => void;
  damagePlayer: (amount: number) => void;
  gainExp: (amount: number) => void;

  addChat: (author: string, text: string, system?: boolean) => void;
  spawnDamage: (sx: number, sy: number, amount: number, crit: boolean, kind?: 'enemy' | 'player') => void;
  removeDamage: (id: number) => void;

  useItem: (id: number) => void;
  toggleInventory: () => void;
}

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

let damageSeq = 1;
let chatSeq = 1;

export const useGameStore = create<GameState>((set, get) => ({
  player: { level: 1, hp: 220, maxHp: 220, mp: 120, maxMp: 120, exp: 0, expMax: 100 },
  inventory: [
    { id: 2000000, name: '紅水 Red Potion', color: 0xff5566, qty: 20, kind: 'potion-hp', heal: 80 },
    { id: 2000001, name: '藍水 Blue Potion', color: 0x55a0ff, qty: 20, kind: 'potion-mp', heal: 50 },
    { id: 4000000, name: '史萊姆球 Slime Bubble', color: 0x55c47a, qty: 7, kind: 'etc' },
  ],
  chat: [{ id: 0, author: 'SYSTEM', text: '歡迎來到楓之谷 (PixiJS + React spike)！', system: true }],
  damage: [],
  inventoryOpen: false,

  patchPlayer: (p) => set((s) => ({ player: { ...s.player, ...p } })),

  healHp: (amount) =>
    set((s) => ({ player: { ...s.player, hp: clamp(s.player.hp + amount, 0, s.player.maxHp) } })),

  healMp: (amount) =>
    set((s) => ({ player: { ...s.player, mp: clamp(s.player.mp + amount, 0, s.player.maxMp) } })),

  damagePlayer: (amount) =>
    set((s) => ({ player: { ...s.player, hp: clamp(s.player.hp - amount, 0, s.player.maxHp) } })),

  gainExp: (amount) => {
    const s = get();
    let { level, exp, expMax, maxHp, hp, maxMp, mp } = s.player;
    exp += amount;
    let leveled = false;
    while (exp >= expMax) {
      exp -= expMax;
      level++;
      expMax = Math.floor(expMax * 1.4 + 25);
      maxHp += 40;
      maxMp += 20;
      hp = maxHp;
      mp = maxMp;
      leveled = true;
    }
    set({ player: { level, exp, expMax, maxHp, hp, maxMp, mp } });
    if (leveled) get().addChat('SYSTEM', `升級了！ Lv.${level}`, true);
  },

  addChat: (author, text, system) =>
    set((s) => ({ chat: [...s.chat.slice(-40), { id: chatSeq++, author, text, system }] })),

  spawnDamage: (sx, sy, amount, crit, kind = 'enemy') => {
    const id = damageSeq++;
    set((s) => ({ damage: [...s.damage, { id, sx, sy, amount, crit, kind }] }));
    setTimeout(() => get().removeDamage(id), 850);
  },

  removeDamage: (id) => set((s) => ({ damage: s.damage.filter((d) => d.id !== id) })),

  useItem: (id) => {
    const s = get();
    const item = s.inventory.find((i) => i.id === id);
    if (!item || item.qty <= 0) return;
    if (item.kind === 'potion-hp' && item.heal) get().healHp(item.heal);
    else if (item.kind === 'potion-mp' && item.heal) get().healMp(item.heal);
    else return;
    set((st) => ({
      inventory: st.inventory.map((i) => (i.id === id ? { ...i, qty: i.qty - 1 } : i)),
    }));
  },

  toggleInventory: () => set((s) => ({ inventoryOpen: !s.inventoryOpen })),
}));
