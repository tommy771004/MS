import Phaser from 'phaser';
import type { InventorySlot, ItemDef, ItemType } from '../types';
import { getItem } from '../data';

/**
 * Tabbed inventory (design.md §3.2): EQUIP / USE / ETC / SETUP / QUEST.
 * Stackable items merge up to their `maxStack`; everything is keyed by itemId
 * so the actual item data stays in the JSON database.
 *
 * Events: 'change', 'equip' (slot, itemId|null), 'mesos'.
 */
export class Inventory extends Phaser.Events.EventEmitter {
  /** One slot array per tab. */
  private readonly tabs: Record<ItemType, InventorySlot[]> = {
    EQUIP: [],
    USE: [],
    ETC: [],
    SETUP: [],
    QUEST: [],
  };

  /** Currently equipped items by slot. */
  readonly equipped: Partial<Record<NonNullable<ItemDef['slot']>, number>> = {};

  mesos = 0;

  private readonly slotsPerTab: number;

  constructor(slotsPerTab = 24) {
    super();
    this.slotsPerTab = slotsPerTab;
  }

  getTab(type: ItemType): readonly InventorySlot[] {
    return this.tabs[type];
  }

  addMesos(amount: number): void {
    this.mesos += amount;
    this.emit('mesos', this.mesos);
  }

  /** Deduct mesos if affordable. Returns false (no change) if too poor. */
  spendMesos(amount: number): boolean {
    if (this.mesos < amount) return false;
    this.mesos -= amount;
    this.emit('mesos', this.mesos);
    return true;
  }

  /**
   * Whether `qty` of an item would fit, counting room left in existing stacks
   * plus the capacity of the tab's free slots. Lets the shop stay transactional
   * (never charge for an item that won't fit).
   */
  canFit(itemId: number, qty: number): boolean {
    const def = getItem(itemId);
    const list = this.tabs[def.type];
    const maxStack = def.maxStack ?? 1;

    let room = 0;
    if (maxStack > 1) {
      for (const slot of list) {
        if (slot.itemId === itemId) room += maxStack - slot.qty;
        if (room >= qty) return true;
      }
    }
    room += (this.slotsPerTab - list.length) * maxStack;
    return room >= qty;
  }

  /** Add `qty` of an item. Returns the amount that didn't fit (0 = all added). */
  add(itemId: number, qty = 1): number {
    const def = getItem(itemId);
    const list = this.tabs[def.type];
    const maxStack = def.maxStack ?? 1;
    let remaining = qty;

    // Top up existing stacks first.
    if (maxStack > 1) {
      for (const slot of list) {
        if (slot.itemId !== itemId || slot.qty >= maxStack) continue;
        const room = maxStack - slot.qty;
        const moved = Math.min(room, remaining);
        slot.qty += moved;
        remaining -= moved;
        if (remaining === 0) break;
      }
    }

    // Then open new slots.
    while (remaining > 0 && list.length < this.slotsPerTab) {
      const moved = Math.min(maxStack, remaining);
      list.push({ itemId, qty: moved });
      remaining -= moved;
    }

    if (remaining !== qty) this.emit('change', def.type);
    return remaining;
  }

  /** Count how many of an item the player holds across its tab. */
  count(itemId: number): number {
    const def = getItem(itemId);
    return this.tabs[def.type].filter((s) => s.itemId === itemId).reduce((n, s) => n + s.qty, 0);
  }

  /** Remove `qty` of an item. Returns true if the full amount was removed. */
  remove(itemId: number, qty = 1): boolean {
    const def = getItem(itemId);
    const list = this.tabs[def.type];
    if (this.count(itemId) < qty) return false;
    let remaining = qty;
    for (let i = list.length - 1; i >= 0 && remaining > 0; i--) {
      if (list[i].itemId !== itemId) continue;
      const moved = Math.min(list[i].qty, remaining);
      list[i].qty -= moved;
      remaining -= moved;
      if (list[i].qty === 0) list.splice(i, 1);
    }
    this.emit('change', def.type);
    return true;
  }

  /**
   * Consume one USE item. Returns its consume effect (or null if it can't be
   * used). The caller applies the effect to the StatManager.
   */
  consumeUse(itemId: number): ItemDef['consume'] | null {
    const def = getItem(itemId);
    if (def.type !== 'USE' || !def.consume) return null;
    if (!this.remove(itemId, 1)) return null;
    return def.consume;
  }

  /** First USE item matching a predicate (used by the quick-slot potions). */
  firstUseMatching(predicate: (def: ItemDef) => boolean): number | null {
    for (const slot of this.tabs.USE) {
      if (predicate(getItem(slot.itemId))) return slot.itemId;
    }
    return null;
  }

  /** Equip an EQUIP item from inventory; returns the previously-equipped id. */
  equip(itemId: number): number | null {
    const def = getItem(itemId);
    if (def.type !== 'EQUIP' || !def.slot) return null;
    if (!this.remove(itemId, 1)) return null;

    const slot = def.slot;
    const previous = this.equipped[slot] ?? null;
    if (previous != null) this.add(previous, 1);
    this.equipped[slot] = itemId;
    this.emit('equip', slot, itemId);
    this.emit('change', 'EQUIP');
    return previous;
  }

  /** Aggregate stats from all equipped items (fed into StatManager). */
  equippedStats(): ItemDef['stats'][] {
    return Object.values(this.equipped)
      .map((id) => (id != null ? getItem(id).stats : undefined))
      .filter((s): s is NonNullable<ItemDef['stats']> => !!s);
  }
}
