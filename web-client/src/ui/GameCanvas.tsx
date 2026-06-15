import { useEffect, useRef } from 'react';
import { PixiGame } from '../game/PixiGame';

/**
 * Mounts the PixiJS game into a div and tears it down on unmount. This is the
 * only React component that touches the WebGL layer; everything else talks to
 * the game through the Zustand store.
 */
export function GameCanvas() {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const game = new PixiGame();
    game.init(host).catch((e) => console.error('PixiGame init failed:', e));
    return () => game.destroy();
  }, []);

  return <div className="game-canvas" ref={hostRef} />;
}
