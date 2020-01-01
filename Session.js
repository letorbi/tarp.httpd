"use strict";

var events = require("events");
var HttpError = require("./HttpError");

module.exports = exports = function(config, request, response) {
    events.EventEmitter.call(this);
    this.$requestJson = undefined;
    this.$type = undefined;
    this.config = config;
    this.request = request;
    this.response = response;
    this.requestText = '';
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

exports.prototype.delegate = function() {
    var hook;
    hook = this.config.hooks[this.request.url] ? this.request.url : "*";
    Promise.resolve().then(
      () => {
        if (!this.config.hooks[hook])
            throw new HttpError(404, "hook not found");
        if (typeof this.config.hooks[hook][this.request.method] !== "function")
            throw new HttpError(501, "missing method");
        return this.config.hooks[hook][this.request.method](this);
      }
    ).then(
      (data) => {
        if (typeof data === "string") {
          this.end(200, data);
        }
        else if (data !== undefined) {
          this.end(200, JSON.stringify(data), "application/json;charset=UTF-8");
        }
        else {
          this.end(200, "");
        }
      }
    ).catch(
      (error) => {
        if (error instanceof HttpError) {
          console.warn("ABORT "+error.toString());
          this.end(error.code, "");
        }
        else {
          console.error("ERROR " + this.request.method.toLowerCase() + " " + this.request.url + " failed with:");
          console.error(error);
          this.end(500, "");
          process.exit(1);
        }
      }
    );
}

exports.prototype.end = function(status, data, type) {
    if (type) { 
      this.response.setHeader("Content-Type", type);
    }
    this.response.statusCode = status;
    this.response.write(data, "utf8");
    this.response.end();
}

Object.defineProperty(exports.prototype, "requestJson", {
    get: function() {
        if (this.$requestJson === undefined)
            this.$requestJson = this.requestText ? JSON.parse(this.requestText) : null;
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
