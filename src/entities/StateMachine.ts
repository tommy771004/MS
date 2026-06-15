/**
 * A tiny finite state machine (design.md §2.1).
 *
 * States are plain objects with optional lifecycle hooks. The owner (e.g. the
 * Player) is passed into every hook so states stay stateless and reusable.
 */
export interface State<Owner> {
  readonly name: string;
  /** Called once when the machine transitions into this state. */
  enter?(owner: Owner, from?: string): void;
  /** Called every frame while active. `dt` is in milliseconds. */
  update?(owner: Owner, dt: number): void;
  /** Called once when leaving this state. */
  exit?(owner: Owner, to?: string): void;
}

export class StateMachine<Owner> {
  private readonly states = new Map<string, State<Owner>>();
  private current?: State<Owner>;
  /** Milliseconds spent in the current state — handy for timed animations. */
  public elapsed = 0;

  constructor(private readonly owner: Owner) {}

  add(state: State<Owner>): this {
    this.states.set(state.name, state);
    return this;
  }

  get currentName(): string {
    return this.current?.name ?? '';
  }

  is(...names: string[]): boolean {
    return this.current ? names.includes(this.current.name) : false;
  }

  /** Transition to `name`. No-op if already in that state (unless `force`). */
  transition(name: string, force = false): void {
    if (!force && this.current?.name === name) return;
    const next = this.states.get(name);
    if (!next) throw new Error(`StateMachine: unknown state "${name}"`);
    const from = this.current?.name;
    this.current?.exit?.(this.owner, name);
    this.current = next;
    this.elapsed = 0;
    next.enter?.(this.owner, from);
  }

  update(dt: number): void {
    this.elapsed += dt;
    this.current?.update?.(this.owner, dt);
  }
}
