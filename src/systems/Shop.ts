import type { Inventory } from './Inventory';
import type { ItemDef, ShopDef } from '../types';
import { getItem, getShop } from '../data';

/** Why a buy/sell attempt failed. */
export type ShopFailReason = 'mesos' | 'space' | 'notInStock' | 'notSellable' | 'noItem';

export interface ShopResult {
  ok: boolean;
  reason?: ShopFailReason;
  /** Mesos that changed hands (cost when buying, gain when selling). */
  mesos: number;
}

/**
 * NPC shop orchestration (design.md §3.2, docs/phase5.md 階段六).
 *
 * The shop is a thin, *authoritative* layer over the {@link Inventory}: every
 * transaction validates mesos and bag space first, then mutates the inventory
 * (which owns the mesos balance and emits its own change events for the UI).
 * No prices are hard-coded here — they come from each ItemDef.
 */
export class Shop {
  constructor(private readonly inventory: Inventory) {}

  /** Sell price for one unit, or null if the item can't be sold. */
  sellPriceOf(item: ItemDef): number | null {
    return item.sellPrice ?? null;
  }

  /** Buy `qty` of `itemId` from `shopId`. Transactional: all-or-nothing. */
  buy(shopId: number, itemId: number, qty = 1): ShopResult {
    const shop: ShopDef = getShop(shopId);
    if (!shop.stock.includes(itemId)) return { ok: false, reason: 'notInStock', mesos: 0 };

    const item = getItem(itemId);
    const cost = (item.buyPrice ?? 0) * qty;

    if (this.inventory.mesos < cost) return { ok: false, reason: 'mesos', mesos: cost };
    if (!this.inventory.canFit(itemId, qty)) return { ok: false, reason: 'space', mesos: cost };

    this.inventory.spendMesos(cost);
    this.inventory.add(itemId, qty);
    return { ok: true, mesos: cost };
  }

  /** Sell `qty` of `itemId` back to the NPC. */
  sell(itemId: number, qty = 1): ShopResult {
    const item = getItem(itemId);
    const unit = this.sellPriceOf(item);
    if (unit == null) return { ok: false, reason: 'notSellable', mesos: 0 };
    if (this.inventory.count(itemId) < qty) return { ok: false, reason: 'noItem', mesos: 0 };

    const gain = unit * qty;
    this.inventory.remove(itemId, qty);
    this.inventory.addMesos(gain);
    return { ok: true, mesos: gain };
  }
}
