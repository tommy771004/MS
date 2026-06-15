import { GameMap } from './GameMap.ts';
import type { CharacterRepo } from '../db/characters.ts';
import { SERVER } from '../config.ts';

/** Server-side monster spawns for the starting map. */
const START_MAP_SPAWNS = [
  { monsterId: 100100, x: 240, y: 560 },
  { monsterId: 100100, x: 420, y: 560 },
  { monsterId: 100101, x: 760, y: 560 },
  { monsterId: 100100, x: 1120, y: 470 },
];

/**
 * Owns every loaded map (RustMS keeps "persistent map state across sessions").
 * Maps are created lazily on first entry.
 */
export class GameWorld {
  private readonly maps = new Map<number, GameMap>();

  constructor(private readonly characters: CharacterRepo) {}

  getMap(mapId: number): GameMap {
    let map = this.maps.get(mapId);
    if (!map) {
      const spawns = mapId === SERVER.startMapId ? START_MAP_SPAWNS : [];
      map = new GameMap(mapId, this.characters, spawns);
      this.maps.set(mapId, map);
    }
    return map;
  }
}
