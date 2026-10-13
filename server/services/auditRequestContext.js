const { AsyncLocalStorage } = require('node:async_hooks');

const requestContext = new AsyncLocalStorage();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Store the request itself: authentication populates req.user after this runs.
function auditRequestContext(req, res, next) {
  requestContext.run({ req }, next);
}

function getAuditRequestContext() {
  const req = requestContext.getStore()?.req;
  const user = req?.user;
  const id = user?.user_id || user?.id;
  return {
    actorId: UUID.test(id || '') ? id : '',
    ip: req?.ip || '',
    userAgent: String(req?.headers?.['user-agent'] || '').slice(0, 2000),
    source: req ? 'request' : 'database',
  };
}

module.exports = { auditRequestContext, getAuditRequestContext };
