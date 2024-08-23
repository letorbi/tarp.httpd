"use strict";

var cluster = require("cluster");
var fs = require("fs");
var http = require("http");
var os = require("os");
var util = require("util");

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
        this.runMaster();
    else
        this.runWorker();
}

exports.prototype.runMaster = function() {
    var isShuttingDown = false;

    if (process.getuid() == 0)
        this.log("warn", "master runs with root privileges")
    process.once('SIGINT', onTerminate.bind(this));
    process.once('SIGTERM', onTerminate.bind(this));

    this.log("info", "master is forking workers...");
    for (var i = 0; i < this.config.workers; i++)
        cluster.fork();

    cluster.on('exit', (worker, code, signal) => {
        if (code > 0) {
            this.log("warn", `worker ${worker.process.pid} exited with code ${code}, respawning...`);
            !isShuttingDown && cluster.fork(); // do not fork during shutdown
        }
        else {
            this.log("info", `worker ${worker.process.pid} exited (${signal})`);
        }
    });

    function onTerminate() {
        this.log("info", "sending shutdown signal to workers...");
        isShuttingDown = true;
        for (const id in cluster.workers)
          cluster.workers[id].send("shutdown");
    }
}

exports.prototype.runWorker = function() {
    process.on('message', (msg) => {
        if (msg === "shutdown")
            process.exit(0); // this also closes the server properly
        else
            this.log("warn", `invalid IPC message "${msg}"`);
    });

    this.httpd = http.createServer();
    if (typeof this.config.socket === "string")
        this.httpd.listen(this.config.socket);
    else
        this.httpd.listen(this.config.port, this.config.host);

    this.httpd.addListener("listening", () => {
        this.log("info", `server listening at ${JSON.stringify(this.httpd.address())}`);
    });

    this.httpd.addListener("error", (error) => {
        this.log("info", "HTTP server error:\n", error);
        process.exit(1);
    })

    this.httpd.addListener("request", (request, response) => {
        response.setHeader("Pragma", "no-cache");
        response.setHeader("Cache-Control", "no-cache");
        response.setHeader("Expires", "-1");
        var session = new this.Session(this, request, response);
        session.run();
    });
}

exports.prototype.log = function(lvl, msg, ...args) {
    if (loglevel[lvl] >= loglevel[this.config.loglevel])
        console[lvl](`${lvl.toUpperCase()} ${new Date().toISOString()} ${process.pid} ${msg}`, ...args);
    else if (loglevel[lvl] === undefined)
        console.log(`invalid loglevel: ${lvl}`);
    else if (loglevel[this.config.loglevel] === undefined)
        console.log(`invalid loglevel in config: ${this.config.loglevel}`);
}
