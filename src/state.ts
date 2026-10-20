import { existsSync } from "node:fs";

const FILE = ".logchimp-migrate-state.json";

/** Tracks imported source posts so re-running never creates duplicates. */
export class State {
  private done = new Set<string>();

  static async load(): Promise<State> {
    const s = new State();
    if (existsSync(FILE)) {
      try {
        s.done = new Set(JSON.parse(await Bun.file(FILE).text()) as string[]);
      } catch {
        /* corrupt file: start fresh */
      }
    }
    return s;
  }

  has(key: string) {
    return this.done.has(key);
  }

  async add(key: string) {
    this.done.add(key);
    await Bun.write(FILE, JSON.stringify([...this.done]));
  }
}
