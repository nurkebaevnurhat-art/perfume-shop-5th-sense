/* GET /api/status — что подключено на сервере (без секретов).
   С заголовком Authorization дополнительно проверяет пароль админки. */
const { send, handler, adminConfigured, isAdmin } = require('../server/http');
const db = require('../server/db');
const telegram = require('../server/telegram');

module.exports = handler({
  async GET(req, res) {
    const storage = db.configured();
    const bot = telegram.configured();
    const data = { ok: true, storage, telegram: bot, admin: adminConfigured(), accepting: storage || bot };
    if (req.headers.authorization) data.authorized = isAdmin(req);
    send(res, 200, data);
  }
});
