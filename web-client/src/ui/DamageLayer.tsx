import { useGameStore } from '../store/gameStore';

/**
 * Floating damage numbers rendered as DOM elements (per the architecture's
 * "傷害數字的 DOM 渲染"). The Pixi layer computes screen coords on each hit and
 * pushes them to the store; CSS animates the float-up + fade.
 */
export function DamageLayer() {
  const damage = useGameStore((s) => s.damage);

  return (
    <div className="damage-layer">
      {damage.map((d) => (
        <span
          key={d.id}
          className={`dmg ${d.kind} ${d.crit ? 'crit' : ''}`}
          style={{ left: `${d.sx}px`, top: `${d.sy}px` }}
        >
          {d.amount}
          {d.crit ? '!' : ''}
        </span>
      ))}
    </div>
  );
}
