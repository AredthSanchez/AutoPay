// Small testing-workspace file storage. R2 can replace this without changing the
// scoped attachments API. Chunking keeps every D1 row below its size limit.
const CHUNK=128*1024,MAX_FILE=5*1024*1024;
export class DatabaseFiles{
 constructor(db){this.db=db}
 q(sql,...values){return this.db.prepare(sql).bind(...values)}
 async put(key,body){const bytes=new Uint8Array(await new Response(body).arrayBuffer());if(bytes.length>MAX_FILE)throw Error('File exceeds 5 MB.');const count=Math.ceil(bytes.length/CHUNK);await this.db.batch([this.q('INSERT INTO file_objects(key,size,chunks) VALUES(?,?,?)',key,bytes.length,count),...Array.from({length:count},(_,n)=>this.q('INSERT INTO file_chunks(key,sequence,data) VALUES(?,?,?)',key,n,bytes.slice(n*CHUNK,(n+1)*CHUNK).buffer))])}
 async get(key){const object=await this.q('SELECT size,chunks FROM file_objects WHERE key=?',key).first();if(!object)return null;let n=0;const q=(...args)=>this.q(...args);return {body:new ReadableStream({async pull(controller){if(n>=object.chunks){controller.close();return}try{const row=await q('SELECT data FROM file_chunks WHERE key=? AND sequence=?',key,n++).first();if(!row)throw Error('Attachment data is unavailable.');const data=row.data;controller.enqueue(data instanceof ArrayBuffer?new Uint8Array(data):new Uint8Array(data))}catch(error){controller.error(error)}}})}}
 async delete(key){await this.db.batch([this.q('DELETE FROM file_chunks WHERE key=?',key),this.q('DELETE FROM file_objects WHERE key=?',key)])}
}
