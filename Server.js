"use strict";

var cluster = require("cluster");
var http = require("http");
var os = require("os");

const loglevel = { log:0, info:1, warn:2, error:3 };

module.exports = exports = function(config, Session) {
    this.Session = Session || require('./Session');
    this.config = config;
    this.routes = {};
    this.hooks = {};
    this.httpd = null;

    if (this.config.workers == "cores")
        this.config.workers = os.cpus().length;
}

exports.prototype.addRoute = function(route, handler) {
    this.routes[route] = handler;
}

exports.prototype.loadPlugin = function(plugin) {
    if (plugin.hooks.load)
        plugin.hooks.load(this);
    for (const name in plugin.hooks) {
        if (name !== "load") {
            if (this.hooks[name] === undefined)
                this.hooks[name] = [plugin.hooks[name]]
            else
                this.hooks[name].push(plugin.hooks[name])
        }
    }
}

exports.prototype.run = function() {
    if (cluster.isMaster)
        this.fork();
    else
        this.setup();
}

exports.prototype.fork = function() {
    if (process.getuid() == 0)
        console.warn("MASTER "+process.pid+" process runs with root privileges!")
    console.info("MASTER "+process.pid+" starting workers");
    for (var i = 0; i < this.config.workers; i++)
        cluster.fork();
    cluster.on('exit', (worker, code, signal) => {
        console.info('WORKER ' + worker.process.pid + ' died');
        cluster.fork();
    });
}

exports.prototype.setup = function() {
    console.info("WORKER "+process.pid+" starting http server");
    this.httpd = http.createServer();
    this.httpd.listen(this.config.port, this.config.host);
    this.httpd.addListener("listening", onListening.bind(this));
    this.httpd.addListener("request", this.listen.bind(this));

    function onListening() {
        var addr = this.httpd.address();
        console.info("WORKER "+process.pid+" listening at "+addr.address+":"+addr.port);
    }
}

exports.prototype.listen = function(request, response) {
    this.log("log", "server listen");
    response.setHeader("Pragma", "no-cache");
    response.setHeader("Cache-Control", "no-cache");
    response.setHeader("Expires", "-1");
    var session = new this.Session(this, request, response);
    session.run();
}

exports.prototype.log = function(lvl, msg, ...args) {
    if (loglevel[lvl] >= loglevel[this.config.loglevel])
        console[lvl](`${lvl} ${new Date().toISOString()} ${msg}`, ...args);
    else if (loglevel[lvl] === undefined)
        console.log(`invalid loglevel: ${lvl}`);
    else if (loglevel[this.config.loglevel] === undefined)
        console.log(`invalid loglevel in config: ${this.config.loglevel}`);
}
