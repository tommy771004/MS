import Phaser from 'phaser';
import { Scenes, GAME_WIDTH, GAME_HEIGHT } from '../config';
import type { StatManager } from '../systems/StatManager';
import type { Inventory } from '../systems/Inventory';
import type { SkillSystem } from '../systems/SkillSystem';
import type { Shop } from '../systems/Shop';
import type { ItemDef, ItemType } from '../types';
import { getItem, getShop } from '../data';
import { SOLIDS, ONE_WAYS } from '../world/level';

export interface UISceneData {
  stats: StatManager;
  inventory: Inventory;
  skills: SkillSystem;
  shop: Shop;
  player: { x: number; y: number; stateName: string };
  monsters: Phaser.Physics.Arcade.Group;
  worldWidth: number;
  worldHeight: number;
}

/** A quick-slot definition (potion or skill) bound to a hotkey. */
interface QuickSlot {
  key: string;
  itemId?: number;
  skillId?: number;
  icon: string;
  x: number;
  y: number;
  overlay: Phaser.GameObjects.Graphics;
  label: Phaser.GameObjects.Text;
}

const PLAYER_NAME = '楓葉冒險家';
const TABS: ItemType[] = ['EQUIP', 'USE', 'ETC', 'SETUP', 'QUEST'];

/** Compact label: the leading (CJK) token of an item's bilingual name. */
function shortName(def: ItemDef): string {
  return def.name.split(' ')[0];
}

/**
 * Screen-space HUD (design.md §2.3). Runs as a parallel scene over GameScene
 * and reacts to StatManager / Inventory / SkillSystem events. Includes the
 * status bar, quick slots, buff icons, a minimap, and a toggleable inventory.
 */
export class UIScene extends Phaser.Scene {
  private d!: UISceneData;

  private hpBar!: Phaser.GameObjects.Graphics;
  private mpBar!: Phaser.GameObjects.Graphics;
  private expBar!: Phaser.GameObjects.Graphics;
  private hpText!: Phaser.GameObjects.Text;
  private mpText!: Phaser.GameObjects.Text;
  private levelText!: Phaser.GameObjects.Text;
  private mesosText!: Phaser.GameObjects.Text;

  private quickSlots: QuickSlot[] = [];
  private buffSlots: { bg: Phaser.GameObjects.Image; text: Phaser.GameObjects.Text }[] = [];

  private minimap!: Phaser.GameObjects.Graphics;
  private minimapDots!: Phaser.GameObjects.Graphics;
  private mmX = 0;
  private mmY = 0;
  private mmW = 220;
  private mmH = 92;
  private mmScale = 1;

  private inventoryOpen = false;
  private invContainer!: Phaser.GameObjects.Container;
  private invTab: ItemType = 'EQUIP';
  private invDynamic: Phaser.GameObjects.GameObject[] = [];

  // ---- Shop window ----
  private shopOpen = false;
  private shopId: number | null = null;
  private shopTab: 'BUY' | 'SELL' = 'BUY';
  private shopContainer!: Phaser.GameObjects.Container;
  private shopBounds!: Phaser.Geom.Rectangle;
  private shopTitle!: Phaser.GameObjects.Text;
  private shopGreeting!: Phaser.GameObjects.Text;
  private shopMesosText!: Phaser.GameObjects.Text;
  private shopStatus!: Phaser.GameObjects.Text;
  private shopTabBuy!: Phaser.GameObjects.Text;
  private shopTabSell!: Phaser.GameObjects.Text;
  private shopDynamic: Phaser.GameObjects.GameObject[] = [];

  /** Cross-scene handlers (GameScene → HUD) kept for clean teardown. */
  private readonly onNpcInteract = (shopId: number): void => this.openShop(shopId);
  private readonly onNpcLeave = (): void => this.closeShop();

  constructor() {
    super(Scenes.UI);
  }

  init(data: UISceneData): void {
    this.d = data;
  }

  create(): void {
    this.buildStatusBar();
    this.buildQuickSlots();
    this.buildBuffBar();
    this.buildMinimap();
    this.buildInventoryPanel();
    this.buildShopPanel();
    this.subscribe();
    this.bindKeys();

    // NPC interaction is driven by GameScene; listen on its event bus.
    const game = this.scene.get(Scenes.Game);
    game.events.on('npc-interact', this.onNpcInteract);
    game.events.on('npc-leave', this.onNpcLeave);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      game.events.off('npc-interact', this.onNpcInteract);
      game.events.off('npc-leave', this.onNpcLeave);
    });

    // Prime everything with current values.
    this.refreshHp(this.d.stats.hp, this.d.stats.maxHP);
    this.refreshMp(this.d.stats.mp, this.d.stats.maxMP);
    this.refreshExp(this.d.stats.exp, this.d.stats.expToNext());
    this.refreshLevel(this.d.stats.level);
    this.refreshMesos(this.d.inventory.mesos);
    this.refreshPotionCounts();
  }

  // ---- Status bar ----------------------------------------------------------

  private buildStatusBar(): void {
    const barTop = GAME_HEIGHT - 70;
    this.add.rectangle(0, barTop, GAME_WIDTH, 70, 0x0c1018, 0.82).setOrigin(0, 0);
    this.add.rectangle(0, barTop, GAME_WIDTH, 2, 0x3a4a63, 1).setOrigin(0, 0);

    // Level badge + name.
    this.add.circle(48, barTop + 32, 26, 0x2a3a55).setStrokeStyle(2, 0x6fa8dc);
    this.levelText = this.add
      .text(48, barTop + 32, 'Lv.1', { fontFamily: 'Arial Black', fontSize: '15px', color: '#ffe45e' })
      .setOrigin(0.5);
    this.add.text(90, barTop + 8, PLAYER_NAME, { fontFamily: 'Microsoft JhengHei, sans-serif', fontSize: '14px', color: '#dfe6f2' });

    // HP / MP bars.
    this.hpBar = this.add.graphics();
    this.mpBar = this.add.graphics();
    this.hpText = this.add
      .text(90 + 130, barTop + 30, '', { fontFamily: 'Arial', fontSize: '11px', color: '#ffffff' })
      .setOrigin(0.5);
    this.mpText = this.add
      .text(90 + 130, barTop + 50, '', { fontFamily: 'Arial', fontSize: '11px', color: '#ffffff' })
      .setOrigin(0.5);

    // EXP bar runs along the very bottom.
    this.expBar = this.add.graphics();
  }

  private refreshHp(hp: number, maxHP: number): void {
    const barTop = GAME_HEIGHT - 70;
    this.drawBar(this.hpBar, 90, barTop + 24, 260, 13, hp / maxHP, 0xff3b4e, 0x3a1015);
    this.hpText.setText(`${Math.ceil(hp)} / ${maxHP}`);
  }

  private refreshMp(mp: number, maxMP: number): void {
    const barTop = GAME_HEIGHT - 70;
    this.drawBar(this.mpBar, 90, barTop + 44, 260, 13, mp / maxMP, 0x2f86e0, 0x0f2540);
    this.mpText.setText(`${Math.ceil(mp)} / ${maxMP}`);
  }

  private refreshExp(exp: number, toNext: number): void {
    const ratio = Phaser.Math.Clamp(exp / toNext, 0, 1);
    this.drawBar(this.expBar, 0, GAME_HEIGHT - 6, GAME_WIDTH, 6, ratio, 0xffcf3f, 0x2a2410);
  }

  private refreshLevel(level: number): void {
    this.levelText.setText(`Lv.${level}`);
  }

  private refreshMesos(mesos: number): void {
    if (this.mesosText) this.mesosText.setText(`${mesos} mesos`);
  }

  private drawBar(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, ratio: number, color: number, bg: number): void {
    const r = Phaser.Math.Clamp(ratio, 0, 1);
    g.clear();
    g.fillStyle(bg, 1).fillRoundedRect(x, y, w, h, 4);
    if (r > 0) g.fillStyle(color, 1).fillRoundedRect(x, y, Math.max(4, w * r), h, 4);
    g.fillStyle(0xffffff, 0.18).fillRoundedRect(x, y, w * r, h / 2, 4);
    g.lineStyle(1, 0x000000, 0.4).strokeRoundedRect(x, y, w, h, 4);
  }

  // ---- Quick slots ---------------------------------------------------------

  private buildQuickSlots(): void {
    const defs = [
      { key: '1', itemId: 2000000, icon: 'icon_potion_hp' },
      { key: '2', itemId: 2000001, icon: 'icon_potion_mp' },
      { key: 'A', skillId: 1001004, icon: 'skill_power_strike' },
      { key: 'S', skillId: 1001005, icon: 'skill_slash_blast' },
    ];
    const size = 46;
    const gap = 8;
    const totalW = defs.length * size + (defs.length - 1) * gap;
    let x = GAME_WIDTH - totalW - 16;
    const y = GAME_HEIGHT - 70 + 12;

    for (const def of defs) {
      this.add.rectangle(x, y, size, size, 0x161c28, 0.95).setOrigin(0, 0).setStrokeStyle(2, 0x47506a);
      this.add.image(x + size / 2, y + size / 2, def.icon).setDisplaySize(size - 12, size - 12);

      const overlay = this.add.graphics();
      const label = this.add
        .text(x + size - 4, y + size - 4, def.key, { fontFamily: 'Arial Black', fontSize: '12px', color: '#ffe45e' })
        .setOrigin(1, 1);
      // count text for potions sits in the top-left
      this.quickSlots.push({ ...def, icon: def.icon, x, y, overlay, label });
      x += size + gap;
    }
  }

  private refreshPotionCounts(): void {
    for (const slot of this.quickSlots) {
      if (slot.itemId == null) continue;
      const count = this.d.inventory.count(slot.itemId);
      const name = `cnt_${slot.itemId}`;
      let txt = this.children.getByName(name) as Phaser.GameObjects.Text | null;
      if (!txt) {
        txt = this.add
          .text(slot.x + 4, slot.y + 3, '', { fontFamily: 'Arial', fontSize: '11px', color: '#ffffff', stroke: '#000', strokeThickness: 3 })
          .setName(name);
      }
      txt.setText(`${count}`);
    }
  }

  private onCooldown(skillId: number, remaining: number, total: number): void {
    const slot = this.quickSlots.find((s) => s.skillId === skillId);
    if (!slot) return;
    slot.overlay.clear();
    if (remaining > 0 && total > 0) {
      const ratio = remaining / total;
      const size = 46;
      slot.overlay.fillStyle(0x000000, 0.6).fillRect(slot.x, slot.y + size * (1 - ratio), size, size * ratio);
      slot.label.setText(`${Math.ceil(remaining / 1000)}`);
    } else {
      slot.label.setText(slot.key);
    }
  }

  // ---- Buff bar ------------------------------------------------------------

  private buildBuffBar(): void {
    for (let i = 0; i < 6; i++) {
      const x = 16 + i * 44;
      const y = 16;
      const bg = this.add.image(x, y, 'skill_rage').setOrigin(0, 0).setDisplaySize(36, 36).setVisible(false);
      const text = this.add
        .text(x + 18, y + 38, '', { fontFamily: 'Arial', fontSize: '11px', color: '#ffffff', stroke: '#000', strokeThickness: 3 })
        .setOrigin(0.5, 0)
        .setVisible(false);
      this.buffSlots.push({ bg, text });
    }
  }

  private updateBuffs(now: number): void {
    const buffs = this.d.skills.activeBuffs();
    for (let i = 0; i < this.buffSlots.length; i++) {
      const slot = this.buffSlots[i];
      const buff = buffs[i];
      if (buff) {
        slot.bg.setTexture(buff.def.icon).setVisible(true);
        slot.text.setText(`${Math.ceil((buff.expiresAt - now) / 1000)}s`).setVisible(true);
      } else {
        slot.bg.setVisible(false);
        slot.text.setVisible(false);
      }
    }
  }

  // ---- Minimap -------------------------------------------------------------

  private buildMinimap(): void {
    this.mmX = GAME_WIDTH - this.mmW - 14;
    this.mmY = 14;
    this.mmScale = this.mmW / this.d.worldWidth;

    this.add.rectangle(this.mmX, this.mmY, this.mmW, this.mmH, 0x0a0e16, 0.7).setOrigin(0, 0).setStrokeStyle(1, 0x47506a);
    this.add
      .text(this.mmX + 6, this.mmY + 2, 'MAP', { fontFamily: 'Arial Black', fontSize: '10px', color: '#7f93b8' })
      .setOrigin(0, 0);

    // Static terrain (drawn once).
    this.minimap = this.add.graphics();
    const sy = this.mmH / this.d.worldHeight;
    this.minimap.fillStyle(0x3a5a78, 1);
    for (const s of SOLIDS) {
      if (s.x < 0 || s.x >= this.d.worldWidth) continue;
      this.minimap.fillRect(this.mmX + s.x * this.mmScale, this.mmY + s.y * sy, Math.max(1, s.w * this.mmScale), Math.max(1, s.h * sy));
    }
    this.minimap.fillStyle(0x6b8f4e, 1);
    for (const p of ONE_WAYS) {
      this.minimap.fillRect(this.mmX + p.x * this.mmScale, this.mmY + p.y * sy, Math.max(1, p.w * this.mmScale), 2);
    }

    this.minimapDots = this.add.graphics();
  }

  private updateMinimap(): void {
    const sy = this.mmH / this.d.worldHeight;
    this.minimapDots.clear();

    // Monsters.
    this.minimapDots.fillStyle(0xff6b6b, 1);
    for (const obj of this.d.monsters.getChildren()) {
      const m = obj as Phaser.GameObjects.Sprite;
      if (!m.active) continue;
      this.minimapDots.fillCircle(this.mmX + m.x * this.mmScale, this.mmY + m.y * sy, 2);
    }

    // Player.
    this.minimapDots.fillStyle(0xffe45e, 1);
    this.minimapDots.fillCircle(this.mmX + this.d.player.x * this.mmScale, this.mmY + this.d.player.y * sy, 3);
  }

  // ---- Inventory panel -----------------------------------------------------

  private buildInventoryPanel(): void {
    const w = 540;
    const h = 360;
    const x = (GAME_WIDTH - w) / 2;
    const y = (GAME_HEIGHT - h) / 2 - 20;

    this.invContainer = this.add.container(0, 0).setDepth(50).setVisible(false);

    const panel = this.add.rectangle(x, y, w, h, 0x10151f, 0.97).setOrigin(0, 0).setStrokeStyle(2, 0x47506a);
    const title = this.add.text(x + 16, y + 12, '背包 Inventory', { fontFamily: 'Microsoft JhengHei', fontSize: '18px', color: '#e7edf7' });
    const close = this.add
      .text(x + w - 16, y + 12, '✕  (I)', { fontFamily: 'Arial', fontSize: '14px', color: '#9fb0cc' })
      .setOrigin(1, 0)
      .setInteractive({ useHandCursor: true });
    close.on('pointerdown', () => this.toggleInventory());

    this.mesosText = this.add
      .text(x + w - 16, y + h - 24, '', { fontFamily: 'Arial Black', fontSize: '14px', color: '#ffcf3f' })
      .setOrigin(1, 0);

    this.invContainer.add([panel, title, close, this.mesosText]);

    // Tabs.
    let tx = x + 16;
    for (const tab of TABS) {
      const tabText = this.add
        .text(tx, y + 44, tab, { fontFamily: 'Arial', fontSize: '13px', color: '#9fb0cc' })
        .setInteractive({ useHandCursor: true })
        .setName(`tab_${tab}`);
      tabText.on('pointerdown', () => {
        this.invTab = tab;
        this.renderInventory();
      });
      this.invContainer.add(tabText);
      tx += tabText.width + 18;
    }

    this.invPanelBounds = new Phaser.Geom.Rectangle(x, y, w, h);
  }

  private invPanelBounds!: Phaser.Geom.Rectangle;

  private renderInventory(): void {
    // Clear previous dynamic content.
    this.invDynamic.forEach((o) => o.destroy());
    this.invDynamic = [];
    if (!this.inventoryOpen) return;

    const b = this.invPanelBounds;

    // Highlight the active tab.
    for (const tab of TABS) {
      const t = this.children.getByName(`tab_${tab}`) as Phaser.GameObjects.Text | null;
      t?.setColor(tab === this.invTab ? '#ffe45e' : '#9fb0cc');
    }

    // Equipped summary on the EQUIP tab.
    let gridTop = b.y + 78;
    if (this.invTab === 'EQUIP') {
      const s = this.d.stats;
      const summary = this.add.text(
        b.x + 16,
        b.y + 70,
        `STR ${s.str}   DEX ${s.dex}   INT ${s.int}   LUK ${s.luk}    ATT ${s.weaponAttack}\n` +
          `已裝備: ${Object.values(this.d.inventory.equipped)
            .map((id) => (id != null ? getItem(id).name.split(' ')[0] : ''))
            .filter(Boolean)
            .join('、') || '無'}`,
        { fontFamily: 'Microsoft JhengHei', fontSize: '12px', color: '#bcd0ee', lineSpacing: 4 },
      );
      this.invDynamic.push(summary);
      gridTop = b.y + 116;
    }

    // Item grid.
    const cols = 6;
    const cell = 54;
    const startX = b.x + 18;
    const slots = this.d.inventory.getTab(this.invTab);

    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i];
      const def = getItem(slot.itemId);
      const cx = startX + (i % cols) * (cell + 6);
      const cy = gridTop + Math.floor(i / cols) * (cell + 6);

      const box = this.add.rectangle(cx, cy, cell, cell, 0x1a2130, 1).setOrigin(0, 0).setStrokeStyle(1, 0x3a4660);
      const icon = this.add.image(cx + cell / 2, cy + cell / 2, def.icon).setDisplaySize(cell - 16, cell - 16);
      const qty = this.add
        .text(cx + cell - 4, cy + cell - 4, slot.qty > 1 ? `${slot.qty}` : '', { fontFamily: 'Arial', fontSize: '11px', color: '#fff', stroke: '#000', strokeThickness: 3 })
        .setOrigin(1, 1);

      box.setInteractive({ useHandCursor: true });
      box.on('pointerover', () => this.showTooltip(def.name, cx, cy));
      box.on('pointerout', () => this.hideTooltip());
      box.on('pointerdown', () => this.useInventoryItem(slot.itemId));

      this.invDynamic.push(box, icon, qty);
    }

    this.refreshMesos(this.d.inventory.mesos);
  }

  private tooltip?: Phaser.GameObjects.Text;
  private showTooltip(text: string, x: number, y: number): void {
    this.hideTooltip();
    this.tooltip = this.add
      .text(x, y - 18, text, { fontFamily: 'Microsoft JhengHei', fontSize: '12px', color: '#fff', backgroundColor: '#000000cc', padding: { x: 6, y: 3 } })
      .setDepth(60);
  }
  private hideTooltip(): void {
    this.tooltip?.destroy();
    this.tooltip = undefined;
  }

  /** Click an item: equip EQUIP, consume USE. */
  private useInventoryItem(itemId: number): void {
    const def = getItem(itemId);
    if (def.type === 'EQUIP') {
      this.d.inventory.equip(itemId);
    } else if (def.type === 'USE') {
      const effect = this.d.inventory.consumeUse(itemId);
      if (effect?.healHP) this.d.stats.healHP(effect.healHP);
      if (effect?.healMP) this.d.stats.healMP(effect.healMP);
    }
    this.renderInventory();
  }

  private toggleInventory(): void {
    this.inventoryOpen = !this.inventoryOpen;
    this.invContainer.setVisible(this.inventoryOpen);
    if (this.inventoryOpen) {
      this.closeShop(); // never stack the two windows
      this.renderInventory();
    } else {
      this.hideTooltip();
      this.invDynamic.forEach((o) => o.destroy());
      this.invDynamic = [];
    }
  }

  // ---- Shop window (docs/phase5.md 階段六) ---------------------------------

  private buildShopPanel(): void {
    const w = 560;
    const h = 384;
    const x = (GAME_WIDTH - w) / 2;
    const y = (GAME_HEIGHT - h) / 2 - 20;

    // Above the inventory panel (depth 50) so it always reads on top.
    this.shopContainer = this.add.container(0, 0).setDepth(55).setVisible(false);
    this.shopBounds = new Phaser.Geom.Rectangle(x, y, w, h);

    const panel = this.add.rectangle(x, y, w, h, 0x10151f, 0.98).setOrigin(0, 0).setStrokeStyle(2, 0xc9a23a);
    const banner = this.add.rectangle(x, y, w, 52, 0x1a2233, 1).setOrigin(0, 0);

    this.shopTitle = this.add.text(x + 16, y + 8, '', { fontFamily: 'Microsoft JhengHei', fontSize: '17px', color: '#ffe9a6' });
    this.shopGreeting = this.add.text(x + 16, y + 31, '', { fontFamily: 'Microsoft JhengHei', fontSize: '12px', color: '#9fc0e0' });

    const close = this.add
      .text(x + w - 14, y + 10, '✕  (ESC)', { fontFamily: 'Arial', fontSize: '13px', color: '#9fb0cc' })
      .setOrigin(1, 0)
      .setInteractive({ useHandCursor: true });
    close.on('pointerdown', () => this.closeShop());

    // Buy / Sell tabs.
    this.shopTabBuy = this.makeShopTab(x + 16, y + 60, '購買 BUY', 'BUY');
    this.shopTabSell = this.makeShopTab(x + 120, y + 60, '販售 SELL', 'SELL');

    this.shopMesosText = this.add
      .text(x + w - 16, y + h - 26, '', { fontFamily: 'Arial Black', fontSize: '14px', color: '#ffcf3f' })
      .setOrigin(1, 0);
    this.shopStatus = this.add
      .text(x + 16, y + h - 26, '', { fontFamily: 'Microsoft JhengHei', fontSize: '13px', color: '#9be79b' })
      .setOrigin(0, 0);

    this.shopContainer.add([panel, banner, this.shopTitle, this.shopGreeting, close, this.shopTabBuy, this.shopTabSell, this.shopMesosText, this.shopStatus]);
  }

  private makeShopTab(x: number, y: number, label: string, tab: 'BUY' | 'SELL'): Phaser.GameObjects.Text {
    const t = this.add
      .text(x, y, label, { fontFamily: 'Arial', fontSize: '14px', color: '#9fb0cc' })
      .setInteractive({ useHandCursor: true });
    t.on('pointerdown', () => {
      this.shopTab = tab;
      this.renderShop();
    });
    return t;
  }

  private openShop(shopId: number): void {
    if (this.shopOpen && this.shopId === shopId) return;
    if (this.inventoryOpen) this.toggleInventory();

    this.shopId = shopId;
    this.shopOpen = true;
    this.shopTab = 'BUY';

    const shop = getShop(shopId);
    this.shopTitle.setText(shop.npcName);
    this.shopGreeting.setText(shop.greeting);
    this.shopStatus.setText('');
    this.shopContainer.setVisible(true);
    this.renderShop();
  }

  private closeShop(): void {
    if (!this.shopOpen) return;
    this.shopOpen = false;
    this.shopId = null;
    this.shopContainer.setVisible(false);
    this.shopDynamic.forEach((o) => o.destroy());
    this.shopDynamic = [];
  }

  private renderShop(): void {
    this.shopDynamic.forEach((o) => o.destroy());
    this.shopDynamic = [];
    if (!this.shopOpen || this.shopId == null) return;

    this.shopTabBuy.setColor(this.shopTab === 'BUY' ? '#ffe45e' : '#9fb0cc');
    this.shopTabSell.setColor(this.shopTab === 'SELL' ? '#ffe45e' : '#9fb0cc');
    this.refreshShopMesos();

    const rows = this.shopTab === 'BUY' ? this.buyRows() : this.sellRows();
    const b = this.shopBounds;
    const startY = b.y + 92;
    const rowH = 42;
    const maxRows = 6;

    if (rows.length === 0) {
      this.addShopChild(
        this.add.text(b.x + 20, startY + 6, '沒有可販售的物品', { fontFamily: 'Microsoft JhengHei', fontSize: '13px', color: '#7f8aa3' }),
      );
      return;
    }

    rows.slice(0, maxRows).forEach((row, i) => {
      this.drawShopRow(b.x + 16, startY + i * rowH, b.width - 32, row);
    });
    if (rows.length > maxRows) {
      this.addShopChild(
        this.add
          .text(b.x + b.width / 2, startY + maxRows * rowH + 2, `…還有 ${rows.length - maxRows} 項`, {
            fontFamily: 'Microsoft JhengHei',
            fontSize: '11px',
            color: '#7f8aa3',
          })
          .setOrigin(0.5, 0),
      );
    }
  }

  /** A shop list entry. `qty` is only meaningful for the SELL tab. */
  private buyRows(): { itemId: number; price: number; qty: number }[] {
    return getShop(this.shopId!).stock.map((itemId) => ({
      itemId,
      price: getItem(itemId).buyPrice ?? 0,
      qty: 1,
    }));
  }

  private sellRows(): { itemId: number; price: number; qty: number }[] {
    const out: { itemId: number; price: number; qty: number }[] = [];
    for (const tab of ['EQUIP', 'USE', 'ETC'] as ItemType[]) {
      for (const slot of this.d.inventory.getTab(tab)) {
        const def = getItem(slot.itemId);
        if (def.sellPrice == null) continue;
        out.push({ itemId: slot.itemId, price: def.sellPrice, qty: slot.qty });
      }
    }
    return out;
  }

  private drawShopRow(x: number, y: number, w: number, row: { itemId: number; price: number; qty: number }): void {
    const def = getItem(row.itemId);
    const buying = this.shopTab === 'BUY';
    const h = 38;

    const box = this.add.rectangle(x, y, w, h, 0x1a2130, 1).setOrigin(0, 0).setStrokeStyle(1, 0x3a4660);
    const icon = this.add.image(x + 22, y + h / 2, def.icon).setDisplaySize(28, 28);
    const label = buying ? def.name : `${def.name}  ×${row.qty}`;
    const name = this.add.text(x + 46, y + h / 2, label, { fontFamily: 'Microsoft JhengHei', fontSize: '13px', color: '#dfe6f2' }).setOrigin(0, 0.5);
    const price = this.add
      .text(x + w - 78, y + h / 2, `${row.price} 楓幣`, { fontFamily: 'Arial', fontSize: '12px', color: '#ffcf3f' })
      .setOrigin(1, 0.5);

    this.addShopChild(box, icon, name, price);

    const onClick = buying ? () => this.handleBuy(row.itemId) : () => this.handleSell(row.itemId, row.qty);
    this.makeRowButton(x + w - 64, y + 7, buying ? '買' : '賣', buying ? 0x2f6f3a : 0x6f3a3a, onClick);
  }

  private makeRowButton(x: number, y: number, label: string, color: number, onClick: () => void): void {
    const btn = this.add.rectangle(x, y, 52, 24, color, 1).setOrigin(0, 0).setStrokeStyle(1, 0xffffff, 0.25).setInteractive({ useHandCursor: true });
    const txt = this.add.text(x + 26, y + 12, label, { fontFamily: 'Arial Black', fontSize: '13px', color: '#ffffff' }).setOrigin(0.5);
    btn.on('pointerover', () => btn.setFillStyle(color, 0.7));
    btn.on('pointerout', () => btn.setFillStyle(color, 1));
    btn.on('pointerdown', onClick);
    this.addShopChild(btn, txt);
  }

  /** Add objects to the shop container (so they layer above the panel) + track for clearing. */
  private addShopChild(...objs: Phaser.GameObjects.GameObject[]): void {
    this.shopContainer.add(objs);
    this.shopDynamic.push(...objs);
  }

  private handleBuy(itemId: number): void {
    if (this.shopId == null) return;
    const def = getItem(itemId);
    const result = this.d.shop.buy(this.shopId, itemId, 1);
    if (result.ok) this.setShopStatus(`購買 ${shortName(def)} ×1   -${result.mesos} 楓幣`, true);
    else if (result.reason === 'mesos') this.setShopStatus('楓幣不足！', false);
    else if (result.reason === 'space') this.setShopStatus('背包空間不足！', false);
    else this.setShopStatus('無法購買', false);
    this.renderShop();
  }

  private handleSell(itemId: number, qty: number): void {
    const def = getItem(itemId);
    const result = this.d.shop.sell(itemId, qty);
    if (result.ok) this.setShopStatus(`賣出 ${shortName(def)} ×${qty}   +${result.mesos} 楓幣`, true);
    else this.setShopStatus('無法賣出', false);
    this.renderShop();
  }

  private setShopStatus(text: string, ok: boolean): void {
    this.shopStatus.setText(text).setColor(ok ? '#9be79b' : '#ff9a9a');
  }

  private refreshShopMesos(): void {
    if (this.shopMesosText) this.shopMesosText.setText(`持有 ${this.d.inventory.mesos} 楓幣`);
  }

  // ---- Events & keys -------------------------------------------------------

  private subscribe(): void {
    const { stats, inventory, skills } = this.d;
    stats.on('hp', (hp: number, max: number) => this.refreshHp(hp, max));
    stats.on('mp', (mp: number, max: number) => this.refreshMp(mp, max));
    stats.on('exp', (exp: number, toNext: number) => this.refreshExp(exp, toNext));
    stats.on('levelup', (lvl: number) => {
      this.refreshLevel(lvl);
      this.refreshExp(stats.exp, stats.expToNext());
    });

    inventory.on('change', () => {
      this.refreshPotionCounts();
      if (this.inventoryOpen) this.renderInventory();
    });
    inventory.on('mesos', (m: number) => {
      this.refreshMesos(m);
      this.refreshShopMesos();
    });
    inventory.on('equip', () => {
      if (this.inventoryOpen) this.renderInventory();
    });

    skills.on('cooldown', (id: number, remaining: number, total: number) => this.onCooldown(id, remaining, total));
  }

  private bindKeys(): void {
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.I).on('down', () => this.toggleInventory());
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC).on('down', () => this.closeShop());
  }

  update(time: number): void {
    this.updateMinimap();
    this.updateBuffs(time);
  }
}
