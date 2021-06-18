"use strict";

var events = require("events");
var HttpError = require("./HttpError");

module.exports = exports = function(server, request, response) {
    events.EventEmitter.call(this);
    this.$requestJson = undefined;
    this.$type = undefined;
    this.server = server;
    this.request = request;
    this.response = response;
    this.requestText = '';
    this.url = new URL(request.url, "http://" + request.headers.host);
}

exports.prototype = Object.create(events.EventEmitter.prototype);

exports.prototype.run = function() {
    this.request.addListener("data", receive.bind(this));
    this.request.addListener("end", delegate.bind(this));

    function receive(chunk) {
        this.requestText += chunk;
    }

    function delegate(error) {
        if (error)
            return this.abort(error);
        this.delegate();
    }
}

exports.prototype.start = async function() {
  // empty function that can be overwritten to execute code before any hook
}

exports.prototype.delegate = function() {
    var hook;
    hook = this.server.hooks[this.url.pathname] ? this.url.pathname : "*";
    this.start().then(
      () => {
        if (!this.server.hooks[hook])
            throw new HttpError(404, "hook not found");
        if (typeof this.server.hooks[hook][this.request.method] !== "function")
            throw new HttpError(501, "missing method");
        return this.server.hooks[hook][this.request.method](this);
      }
    ).then(
      (data) => {
        if (typeof data === "string") {
            return this.end(200, data);
        }
        else if (data !== undefined) {
            return this.end(200, JSON.stringify(data), "application/json;charset=UTF-8");
        }
        else {
            return this.end(200, "");
        }
      }
    ).catch(
      (error) => {
        if (error instanceof HttpError) {
          console.warn("ABORT "+error.toString());
          if (error.exception)
              console.log(error.exception);
          return this.end(error.code, "");
        }
        else {
          throw error;
        }
      }
    ).catch(
      (error) => {
        console.error("ERROR " + this.request.method.toLowerCase() + " " + this.url.pathname + " failed with:");
        console.error(error);
        return this.end(500, "").then(() => process.exit(1));
      }
    ).catch(
      (error) => {
        console.error("PANIC " + this.request.method.toLowerCase() + " " + this.url.pathname + " failed with:");
        console.error(error);
        process.exit(2)
      }
    );
}

exports.prototype.end = async function(status, data, type) {
    if (type) { 
        this.response.setHeader("Content-Type", type);
    }
    this.response.statusCode = status;
    this.response.write(data, "utf8");
    this.response.end();
}

Object.defineProperty(exports.prototype, "requestJson", {
    get: function() {
        if (this.$requestJson === undefined) {
            try {
                this.$requestJson = this.requestText ? JSON.parse(this.requestText) : null;
            }
            catch (e) {
                throw new HttpError(400, "invalid JSON request", null, e);
            }
        }
        return this.$requestJson;
    }
});

Object.defineProperty(exports.prototype, "type", {
    get: function() {
        if (this.$type === undefined) {
            this.$type = null;
            if (this.request.headers['content-type']) {
                this.$type = {
                    'name': null,
                    'options': {}
                };
                this.$type.name = this.request.headers['content-type'].replace(/;\s*([^;=]*)\s*=\s*([^;]*)\s*/g, function(m, p1, p2) {
                    if (p1.length)
                        this.$type.options[p1] = p2;
                    return "";
                }.bind(this));
            }
        }
        return this.$type;
    }
});
