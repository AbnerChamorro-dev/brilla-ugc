import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const source = await readFile(new URL("../app/lib/portfolio-storage.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const { chooseDraft, createSaveQueue, readDraft, writeDraft, portfolioAssetDatabase } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

test("returning accounts load their remote data even with an empty or unrelated local draft", () => {
  const remote = { name: "Aleja", bio: "Contenido UGC", services: ["Video"] };
  assert.deepEqual(chooseDraft(remote, "v2", null).content, remote);
  assert.deepEqual(chooseDraft(remote, "v2", { content: {}, baseUpdatedAt: null, dirty: false }).content, remote);
  const stale = { content: { name: "Otra cuenta" }, baseUpdatedAt: "v1", dirty: true };
  const result = chooseDraft(remote, "v2", stale);
  assert.deepEqual(result.content, remote);
  assert.deepEqual(result.conflict, stale);
});

test("unsynced edits resume only when based on the same remote revision", () => {
  const remote = { name: "Antes" };
  const local = { content: { name: "Después" }, baseUpdatedAt: "v1", dirty: true };
  assert.deepEqual(chooseDraft(remote, "v1", local), { content: local.content, conflict: null });
  assert.deepEqual(chooseDraft(remote, "v2", local), { content: remote, conflict: local });
});

test("drafts and media caches cannot cross guest/account boundaries", () => {
  const values = new Map();
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  const draft = { content: { name: "Cuenta A" }, baseUpdatedAt: "v1", dirty: true };
  assert.equal(writeDraft(storage, "A", draft), true);
  assert.deepEqual(readDraft(storage, "A"), draft);
  assert.equal(readDraft(storage, "B"), null);
  assert.equal(readDraft(storage, null), null);
  assert.notEqual(portfolioAssetDatabase("A"), portfolioAssetDatabase("B"));
  assert.notEqual(portfolioAssetDatabase(null), portfolioAssetDatabase("A"));
});

test("corrupted or disabled local storage does not prevent remote recovery", () => {
  assert.equal(readDraft({ getItem: () => "invalid JSON" }, "A"), null);
  assert.equal(readDraft({ getItem: () => { throw new Error("Blocked"); } }, "A"), null);
  assert.equal(writeDraft({ setItem: () => { throw new Error("Quota"); } }, "A", {}), false);
});

test("publication waits for an older save and a failed write does not lock the queue", async () => {
  const enqueue = createSaveQueue();
  const events = [];
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const first = enqueue(async () => { events.push("draft-start"); await gate; events.push("draft-end"); });
  const second = enqueue(async () => { events.push("published"); });
  await Promise.resolve();
  assert.deepEqual(events, ["draft-start"]);
  release();
  await Promise.all([first, second]);
  assert.deepEqual(events, ["draft-start", "draft-end", "published"]);
  await assert.rejects(enqueue(async () => { throw new Error("offline"); }));
  assert.equal(await enqueue(async () => "reconnected"), "reconnected");
});
