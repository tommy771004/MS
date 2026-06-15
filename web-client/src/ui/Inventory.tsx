import { useGameStore } from '../store/gameStore';

const hex = (color: number): string => `#${color.toString(16).padStart(6, '0')}`;

/** Toggleable inventory window (DOM). Click a potion to drink it. */
export function Inventory() {
  const open = useGameStore((s) => s.inventoryOpen);
  const inventory = useGameStore((s) => s.inventory);
  const useItem = useGameStore((s) => s.useItem);
  const toggle = useGameStore((s) => s.toggleInventory);

  if (!open) return null;

  return (
    <div className="inv-panel">
      <div className="inv-head">
        <span>背包 Inventory</span>
        <button className="inv-close" onClick={toggle}>
          ✕ (I)
        </button>
      </div>
      <div className="inv-grid">
        {inventory.map((item) => (
          <button
            key={item.id}
            className="inv-slot"
            title={item.kind.startsWith('potion') ? `${item.name} — 點擊使用` : item.name}
            onClick={() => useItem(item.id)}
          >
            <span className="inv-icon" style={{ background: hex(item.color) }} />
            <span className="inv-qty">{item.qty}</span>
          </button>
        ))}
      </div>
      <div className="inv-hint">點擊紅水/藍水即可回復 HP/MP（與 WebGL 角色共用同一份狀態）</div>
    </div>
  );
}
