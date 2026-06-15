import { useGameStore } from '../store/gameStore';

const pct = (v: number, max: number): string => `${Math.max(0, Math.min(100, (v / max) * 100))}%`;

/** Bottom status bar — HP / MP / EXP, rendered as plain DOM (not in WebGL). */
export function Hud() {
  const player = useGameStore((s) => s.player);

  return (
    <div className="hud">
      <div className="level-badge">Lv.{player.level}</div>
      <div className="bars">
        <div className="bar">
          <div className="bar-fill hp" style={{ width: pct(player.hp, player.maxHp) }} />
          <span className="bar-label">HP {Math.ceil(player.hp)} / {player.maxHp}</span>
        </div>
        <div className="bar">
          <div className="bar-fill mp" style={{ width: pct(player.mp, player.maxMp) }} />
          <span className="bar-label">MP {Math.ceil(player.mp)} / {player.maxMp}</span>
        </div>
        <div className="bar exp">
          <div className="bar-fill xp" style={{ width: pct(player.exp, player.expMax) }} />
          <span className="bar-label">EXP {Math.floor((player.exp / player.expMax) * 100)}%</span>
        </div>
      </div>
    </div>
  );
}
