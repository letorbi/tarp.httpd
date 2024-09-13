var pg = require("pg");

var pool = null;
var config = null;

function load(server) {
  config = server.config.plugins.nodepg;
}

async function connect(session) {
    if (pool === null)
        pool = new pg.Pool(config);
    session.client = await pool.connect();
}

async function disconnect(session) {
    await session.client?.release();
    session.client = null;
}

exports.hooks = { load, connect, disconnect };
