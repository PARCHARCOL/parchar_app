function createCreativeReadCache({ ttl = 3000, maxEntries = 32, maxBytes = 4 * 1024 * 1024, now = Date.now } = {}) {
  const entries = new Map();
  let generation = 0, bytes = 0;
  function remove(key) { const old = entries.get(key); if (old) bytes -= old.bytes || 0; entries.delete(key); }
  return {
    async read(key, load) {
      const prior = entries.get(key);
      if (prior && (prior.pending || prior.expires > now())) return prior.promise;
      remove(key);
      const stamp = generation;
      const record = { expires: now() + ttl, promise: null, pending: true };
      // Coalesce simultaneous requests for one public zone without caching private data.
      record.promise = Promise.resolve().then(load).then((value) => {
        record.pending = false;
        if (generation === stamp && entries.get(key) === record) {
          record.expires = now() + ttl; record.bytes = Buffer.byteLength(JSON.stringify(value)); bytes += record.bytes;
          while (bytes > maxBytes && entries.size) remove(entries.keys().next().value);
        }
        return value;
      }).catch((error) => { if (entries.get(key) === record) remove(key); throw error; });
      entries.set(key, record);
      while (entries.size > maxEntries) remove(entries.keys().next().value);
      return record.promise;
    },
    invalidate() { generation++; entries.clear(); bytes = 0; },
    get size() { return entries.size; }, get bytes() { return bytes; }
  };
}
module.exports = { createCreativeReadCache };
