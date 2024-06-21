"use strict";

var cluster = require("cluster");
var http = require("http");
var os = require("os");

module.exports = exports = function(config, Session) {
    this.Session = Session || require('./Session');
    this.config = config;
    this.hooks = {};
    this.plugins = [require("./plugins/json")];
    this.httpd = null;

    if (this.config.workers == "cores")
        this.config.workers = os.cpus().length;
}

exports.prototype.addHookHandler = function(hook, handler) {
    this.hooks[hook] = handler;
}

exports.prototype.addPlugin = function(plugin) {
    this.plugins.push()
}

exports.prototype.run = function() {
    if (cluster.isMaster)
        this.setup();
    else
        this.connect();
}

exports.prototype.setup = function() {
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

exports.prototype.connect = function() {
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
    response.setHeader("Pragma", "no-cache");
    response.setHeader("Cache-Control", "no-cache");
    response.setHeader("Expires", "-1");
    var session = new this.Session(this, request, response);
    session.run();
}
