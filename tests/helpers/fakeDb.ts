import { ObjectId } from "mongodb";

type Doc = Record<string, unknown>;
const same = (a: unknown, b: unknown) =>
  a instanceof ObjectId || b instanceof ObjectId ? String(a) === String(b) : a === b;
const tick = () => Promise.resolve(); // yield, so concurrent requests really interleave

function matches(doc: Doc, filter: Doc) {
  return Object.entries(filter).every(([k, v]) => {
    if (v && typeof v === "object" && "$in" in (v as Doc)) {
      return ((v as { $in: unknown[] }).$in).some((x) => same(doc[k], x));
    }
    return same(doc[k], v);
  });
}

/** Minimal in-memory stand-in for the Mongo Collection methods the app uses. */
export class FakeCollection {
  docs: Doc[] = [];
  constructor(private uniqueField?: string) {}

  async findOne(filter: Doc) { await tick(); const d = this.docs.find((x) => matches(x, filter)); return d ? { ...d } : null; }
  find(filter: Doc) {
    const rows = () => this.docs.filter((x) => matches(x, filter)).map((d) => ({ ...d }));
    const cursor = { sort: () => cursor, toArray: async () => { await tick(); return rows(); } };
    return cursor;
  }
  async countDocuments(filter: Doc) { await tick(); return this.docs.filter((x) => matches(x, filter)).length; }
  async insertOne(doc: Doc) {
    await tick();
    if (this.uniqueField && this.docs.some((d) => d[this.uniqueField!] === doc[this.uniqueField!])) {
      throw Object.assign(new Error("E11000 duplicate key"), { code: 11000 });
    }
    const _id = (doc._id as ObjectId) ?? new ObjectId();
    this.docs.push({ ...doc, _id });
    return { insertedId: _id };
  }
  async updateOne(filter: Doc, update: { $set?: Doc }) {
    await tick();
    const d = this.docs.find((x) => matches(x, filter)); // find + write below are synchronous => atomic
    if (!d) return { matchedCount: 0 };
    Object.assign(d, update.$set);
    return { matchedCount: 1 };
  }
  async deleteMany(filter: Doc) {
    await tick();
    const before = this.docs.length;
    this.docs = this.docs.filter((x) => !matches(x, filter));
    return { deletedCount: before - this.docs.length };
  }
}

export function createFakeDb() {
  const cols: Record<string, FakeCollection> = { users: new FakeCollection("email"), habits: new FakeCollection() };
  return { collection: (name: string) => cols[name], cols };
}
