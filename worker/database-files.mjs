/**
 * Saves and retrieves invoice attachments using the database when separate R2 file storage is
 * not configured. Splits files into small pieces for storage and sends those pieces back in
 * order when downloading.
 * Deletes the stored pieces when a file is removed. The invoice service checks access before
 * asking this file to read or save an attachment.
 */
// For this testing version, store files in the database as small pieces so each
// piece fits its size limit. R2, a separate file-storage service, can replace this
// later without changing how invoice screens ask the server for attachments.
const CHUNK = 128 * 1024,
  MAX_FILE = 5 * 1024 * 1024;
export class DatabaseFiles {
  constructor(db) {
    this.db = db;
  }
  q(sql, ...values) {
    return this.db.prepare(sql).bind(...values);
  }
  // Save the file information and all its pieces together, so a failed save does not leave a
  // file with missing pieces.
  async put(key, body) {
    const bytes = new Uint8Array(await new Response(body).arrayBuffer());
    if (bytes.length > MAX_FILE) throw Error("File exceeds 5 MB.");
    const count = Math.ceil(bytes.length / CHUNK);
    await this.db.batch([
      this.q("INSERT INTO file_objects(key,size,chunks) VALUES(?,?,?)", key, bytes.length, count),
      ...Array.from({ length: count }, (_, n) =>
        this.q(
          "INSERT INTO file_chunks(key,sequence,data) VALUES(?,?,?)",
          key,
          n,
          bytes.slice(n * CHUNK, (n + 1) * CHUNK).buffer,
        ),
      ),
    ]);
  }
  // Send the saved file one piece at a time, in order, instead of loading the whole file into
  // memory first.
  async get(key) {
    const object = await this.q("SELECT size,chunks FROM file_objects WHERE key=?", key).first();
    if (!object) return null;
    let n = 0;
    const q = (...args) => this.q(...args);
    return {
      body: new ReadableStream({
        async pull(controller) {
          if (n >= object.chunks) {
            controller.close();
            return;
          }
          try {
            const row = await q(
              "SELECT data FROM file_chunks WHERE key=? AND sequence=?",
              key,
              n++,
            ).first();
            if (!row) throw Error("Attachment data is unavailable.");
            const data = row.data;
            controller.enqueue(
              data instanceof ArrayBuffer ? new Uint8Array(data) : new Uint8Array(data),
            );
          } catch (error) {
            controller.error(error);
          }
        },
      }),
    };
  }
  // Delete the file pieces first, then remove the record that describes the file.
  async delete(key) {
    await this.db.batch([
      this.q("DELETE FROM file_chunks WHERE key=?", key),
      this.q("DELETE FROM file_objects WHERE key=?", key),
    ]);
  }
}
