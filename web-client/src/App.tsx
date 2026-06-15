import { GameCanvas } from './ui/GameCanvas';
import { Hud } from './ui/Hud';
import { Inventory } from './ui/Inventory';
import { Chat } from './ui/Chat';
import { DamageLayer } from './ui/DamageLayer';

/**
 * The two-layer composition: a PixiJS/WebGL <GameCanvas/> with the React DOM UI
 * (damage numbers, HP/MP/EXP, chat, inventory) layered on top. Both read/write
 * the same Zustand store, so the layers stay in sync without either owning the
 * other.
 */
export function App() {
  return (
    <div className="app">
      <header className="brand">🍁 楓之谷 Clone — PixiJS (WebGL) + React/Zustand (DOM) 雙層架構</header>
      <div className="stage">
        <GameCanvas />
        {/* DOM overlay layers */}
        <DamageLayer />
        <Hud />
        <Chat />
        <Inventory />
        <div className="hint">
          移動 <b>← →</b> · 跳躍 <b>Space</b> · 攻擊 <b>X / Ctrl</b> · 喝水 <b>1 / 2</b> · 背包 <b>I</b>
        </div>
      </div>
      <footer className="note">
        下層 = PixiJS 容器紙娃娃 + Foothold 地形碰撞 + 視差捲動；上層 = React DOM UI。僅供研究用途。
      </footer>
    </div>
  );
}
