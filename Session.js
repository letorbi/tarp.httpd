"use strict";

var events = require("events");
var path = require("path");
var mime = require("mime.json");

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
      (body) => {
        // TODO Mime-type detection should be part of a hook wrapper
        if (body && body.constructor === Buffer) {
            let ext = path.extname(this.url.pathname.replace(/\/$/, "/index.html")).substr(1);
            return this.end(200, body,  mime[ext] || "application/octet-stream");
        }
        if (body !== undefined) {
            return this.end(...this.server.plugins.reduce(
                (data, plugin) => plugin.parseResponse(...data),
                [200, body, "text/plain"]
            ));
        }
        else {
            return this.end(200);
        }
      }
    ).catch(
      (error) => {
        if (error instanceof HttpError) {
          console.warn("ABORT "+error.toString());
          if (error.exception)
              console.log(error.exception);
          return this.end(error.code, error.message);
        }
        else {
          throw error;
        }
      }
    ).catch(
      (error) => {
        console.error("ERROR " + this.request.method.toLowerCase() + " " + this.url.pathname + " failed with:");
        console.error(error);
        return this.end(500, "Internal server error");
      }
    ).catch(
      (error) => {
        console.error("PANIC " + this.request.method.toLowerCase() + " " + this.url.pathname + " failed with:");
        console.error(error);
        process.exit(1)
      }
    );
}

exports.prototype.end = async function(status, data, type) {
    this.response.statusCode = status;
    if (type)
        this.response.setHeader("Content-Type", type);
    if (data)
        this.response.write(data, "utf8");
    this.response.end();
}

exports.prototype.validateJson = function(template) {
  function validateObject(obj, tmp, chain) {
    if (typeof obj !== "object") {
      throw new HttpError(400, `Key is not an object: ${chain}`);
    }
    var tmpKeys = Object.keys(tmp);
    for (let key of tmpKeys) {
      if (!Object.hasOwn(obj, key)) {
        throw new HttpError(400, `Key is missing: ${chain}.${key}`);
      }
      if (Array.isArray(tmp[key])) {
        validateArray(obj[key], tmp[key], `${chain}.${key}`);
      }
      else if (typeof tmp[key] === "object") {
        validateObject(obj[key], tmp[key], `${chain}.${key}`);
      }
      else if (typeof obj[key] != tmp[key]) {
        throw new HttpError(400, `Key is not of type ${tmp[key]}: ${chain}.${key}`);
      }
    }
  }

  function validateArray(arr, tmp, chain) {
    if (!Array.isArray(arr)) {
      throw new HttpError(400, `Key is not an array: ${chain}`);
    }
    for (let idx = 0; idx < arr.length; idx++) {
      if (Array.isArray(tmp[0])) {
        validateArray(arr[idx], tmp[0], `${chain}.${idx}`);
      }
      else if (typeof tmp[0] === "object") {
        validateObject(arr[idx], tmp[0], `${chain}.${idx}`);
      }
      else if (typeof arr[idx] != tmp[0]) {
        throw new HttpError(400, `Key is not of type ${tmp[0]}: ${chain}.${idx}`);
      }
    }
  }

  if (Array.isArray(template)) {
    validateArray(this.requestJson, template, "JSON");
  } else {
    validateObject(this.requestJson, template, "JSON");
  }
};

Object.defineProperty(exports.prototype, "requestJson", {
    get: function() {
        if (this.$requestJson === undefined) {
            this.$requestJson = this.server.plugins.reduce(
                (body, plugin) => plugin.parseRequest(body),
                this.requestText
            )
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
