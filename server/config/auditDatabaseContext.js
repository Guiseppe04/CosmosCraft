const { getAuditRequestContext } = require('../services/auditRequestContext');

const CONTEXT_SQL = `SELECT
  set_config('cosmos.audit_actor_id', $1, true),
  set_config('cosmos.audit_ip', $2, true),
  set_config('cosmos.audit_user_agent', $3, true),
  set_config('cosmos.audit_source', $4, true)`;

function withCallback(promise, callback) {
  if (!callback) return promise;
  promise.then(result => callback(null, result), error => callback(error));
}

/**
 * Pass request identity to triggers, never create audit entries here.
 * SET LOCAL lives on the same connection and transaction as the business query.
 * Standalone queries get a short transaction; explicit transactions retain their
 * normal BEGIN/COMMIT/ROLLBACK behavior. Queries on a client are serialized so
 * concurrent callers cannot mix their transaction-local identity.
 */
function wrapAuditClient(client, contextReader = getAuditRequestContext) {
  const rawQuery = client.query.bind(client);
  const rawRelease = client.release.bind(client);
  let inTransaction = false;
  let queue = Promise.resolve();
  let released = false;
  let lastContext = null;

  async function setContext(context) {
    const values = [context.actorId, context.ip, context.userAgent, context.source];
    const key = JSON.stringify(values);
    if (key === lastContext) return;
    await rawQuery(CONTEXT_SQL, values);
    lastContext = key;
  }

  client.query = (...args) => {
    const callback = typeof args.at(-1) === 'function' ? args.pop() : null;
    const context = contextReader();
    const text = typeof args[0] === 'string' ? args[0] : args[0]?.text;
    const command = String(text || '').replace(/^(?:\s|--[^\n]*\n|\/\*[\s\S]*?\*\/)+/, '').trim();
    const begin = /^(BEGIN|START\s+TRANSACTION)\b/i.test(command);
    const end = /^(COMMIT|END|ROLLBACK(?!\s+TO)|ABORT)\b/i.test(command);
    const savepoint = /^(SAVEPOINT|RELEASE|ROLLBACK\s+TO)\b/i.test(command);
    const task = queue.then(async () => {
      if (released) throw new Error('Cannot query a released database client');
      if (begin) {
        const result = await rawQuery(...args);
        inTransaction = true;
        lastContext = null;
        await setContext(context);
        return result;
      }
      if (end || savepoint) {
        const result = await rawQuery(...args);
        if (end) { inTransaction = false; lastContext = null; }
        // ROLLBACK TO may restore an earlier setting; refresh on the next query.
        if (/^ROLLBACK\s+TO\b/i.test(command)) lastContext = null;
        return result;
      }
      if (inTransaction) {
        await setContext(context);
        return rawQuery(...args);
      }
      await rawQuery('BEGIN');
      lastContext = null;
      try {
        await setContext(context);
        const result = await rawQuery(...args);
        await rawQuery('COMMIT');
        return result;
      } catch (error) {
        await rawQuery('ROLLBACK').catch(() => {});
        throw error;
      } finally {
        lastContext = null;
      }
    });
    queue = task.catch(() => {});
    return withCallback(task, callback);
  };

  client.release = (error) => {
    if (released) throw new Error('Database client already released');
    released = true;
    // A forgotten transaction must never be returned to another request.
    client.query = rawQuery;
    client.release = rawRelease;
    rawRelease(error || (inTransaction ? new Error('Released with an open transaction') : undefined));
  };
  return client;
}

function installAuditDatabaseContext(pool) {
  const rawConnect = pool.connect.bind(pool);
  pool.connect = (callback) => {
    const promise = rawConnect().then(client => wrapAuditClient(client));
    if (!callback) return promise;
    promise.then(client => callback(null, client, client.release), error => callback(error));
  };
  pool.query = (...args) => {
    const callback = typeof args.at(-1) === 'function' ? args.pop() : null;
    const promise = (async () => {
      const client = await pool.connect();
      try { return await client.query(...args); }
      finally { client.release(); }
    })();
    return withCallback(promise, callback);
  };
  return pool;
}

module.exports = { wrapAuditClient, installAuditDatabaseContext };
