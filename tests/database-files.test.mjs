/**
 * Checks that an attachment can be split into database pieces, read back with exactly the same
 * contents, and fully removed when deleted.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { setup } from "./helpers.mjs";
import { DatabaseFiles } from "../worker/database-files.mjs";
test("database attachment storage preserves multi-chunk binary files and removes all chunks", async () => {
  const { db, sqlite } = setup();
  const files = new DatabaseFiles(db);
  const bytes = Uint8Array.from({ length: 300000 }, (_, i) => i % 251);
  await files.put("business/invoice/file", bytes);
  const object = await files.get("business/invoice/file");
  assert.deepEqual(new Uint8Array(await new Response(object.body).arrayBuffer()), bytes);
  assert.equal(sqlite.prepare("SELECT count(*) AS n FROM file_chunks").get().n, 3);
  assert.equal(await files.get("another-business/invoice/file"), null);
  await files.delete("business/invoice/file");
  assert.equal(await files.get("business/invoice/file"), null);
  assert.equal(sqlite.prepare("SELECT count(*) AS n FROM file_chunks").get().n, 0);
  sqlite.close();
});
