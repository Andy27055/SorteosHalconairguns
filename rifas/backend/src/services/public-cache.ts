// Public reads only. Reservations and payments always use PostgreSQL directly.
export class PublicCache {
  private entries = new Map<string, { until: number; value: Promise<unknown> }>();
  constructor(private ttlMs = 1000, private maxEntries = 200) {}

  get<T>(key: string, load: () => Promise<T>): Promise<T> {
    const hit = this.entries.get(key);
    if (hit && hit.until > Date.now()) return hit.value as Promise<T>;
    this.entries.delete(key);
    if (this.entries.size >= this.maxEntries) this.entries.delete(this.entries.keys().next().value!);
    const entry = { until: Infinity, value: Promise.resolve().then(load) };
    this.entries.set(key, entry);
    entry.value.then(() => { entry.until = Date.now() + this.ttlMs; }, () => {
      if (this.entries.get(key) === entry) this.entries.delete(key);
    });
    return entry.value;
  }

  clear() { this.entries.clear(); }
}
