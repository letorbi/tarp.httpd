"use strict";

var cluster = require("cluster");
var http = require("http");
var os = require("os");

var Session = require('./Session');

exports.config = function(custom) {
  return Object.assign({
    hooks: {},
    host: "0.0.0.0",
    port: "80",
    session: require("./Session"),
    workers: os.cpus().length
  }, custom);
}

exports.run = function(config) {
  if (cluster.isMaster)
    return runMaster;
  else
    return runWorker;

  function runMaster() {
    console.info("MASTER "+process.pid+" runing workers");
    forkWorker(config.workers).on('exit', onExit);

    function onExit(worker, code, signal) {
      console.info('WORKER ' + worker.process.pid + ' exited');
      cluster.fork();
    }

    function forkWorker(count) {
      if (count > 0) {
        cluster.fork();
        forkWorker(count - 1);
      }
      return cluster;
    }
  }

  function runWorker() {
    console.info("WORKER "+process.pid+" runing http server");
    var httpd = http.createServer();
    httpd.listen(config.port, config.host);
    httpd.addListener("listening", onListening);
    httpd.addListener("request", onRequest);

    function onListening() {
      var addr = httpd.address();
      console.info("WORKER "+process.pid+" listening at "+addr.address+":"+addr.port);
    }

    function onRequest(request, response) {
      console.log("WORKER "+process.pid+" received request");
      response.setHeader("Pragma", "no-cache");
      response.setHeader("Cache-Control", "no-cache");
      response.setHeader("Expires", "-1");
      var session = new config.session(config, request, response);
      session.run();
    }
  }
}
