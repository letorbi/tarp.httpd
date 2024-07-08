"use strict";

var events = require("events");
var path = require("path");
var mime = require("mime.json");

var HttpError = require("./HttpError");

module.exports = exports = function(server, request, response) {
    events.EventEmitter.call(this);
    this.$requestBody = undefined;
    this.$requestType = undefined;
    this.server = server;
    this.request = request;
    this.requestText = '';
    this.requestUrl = new URL(request.url, "http://" + request.headers.host);
    this.response = response;
    this.responseBody = undefined;
    this.responseCode = undefined;
    this.responseType = undefined;
    this.waitForRequestData = true;
}

exports.prototype = Object.create(events.EventEmitter.prototype);

exports.prototype.run = async function() {
    try {
        try {
            await this.execHooks("connect");
            await this.connect();
            await this.execHooks("start");
            await this.start();

            // TODO Mime-type detection should be part of a route wrapper
            if (this.responseBody && this.responseBody.constructor === Buffer) {
                let ext = path.extname(this.requestUrl.pathname.replace(/\/$/, "/index.html")).substr(1);
                this.responseType = mime[ext];
            }

            await this.execHooks("end");
            await this.end();
        }
        catch (error) {
            if (error instanceof HttpError) {
                console.warn("ABORT "+error.toString());
                if (error.exception)
                    console.log(error.exception);
                this.responseCode = error.code;
                this.responseType = "text/plain"
                this.responseBody = error.message;
            }
            else {
                console.error("ERROR " + this.request.method.toLowerCase() + " " + this.requestUrl.pathname + " failed with:");
                console.error(error);
                this.responseCode = 500;
                this.responseType = "text/plain"
                this.responseBody = "Internal server error";
            }
            await this.end();
        }
    }
    catch (panic) {
        console.error("PANIC " + this.request.method.toLowerCase() + " " + this.requestUrl.pathname + " failed with:");
        console.error(panic);
        process.exit(1)
    }
}

exports.prototype.connect = function() {
    return new Promise((resolve, reject) => {
        if (this.waitForRequestData) {
            this.request.addListener("data", (chunk) => this.requestText += chunk);
            this.request.addListener("end", () => resolve());
        }
        else {
            resolve()
        }
    });
}

exports.prototype.start = async function() {
    const route = this.server.routes[this.requestUrl.pathname] ? this.requestUrl.pathname : "*";
    if (!this.server.routes[route])
        throw new HttpError(404, "route not found");
    if (typeof this.server.routes[route][this.request.method] !== "function")
        throw new HttpError(501, "missing method");
    this.responseBody = await this.server.routes[route][this.request.method](this);
}


exports.prototype.end = async function() {
    this.response.statusCode = this.responseCode || 200;
    this.response.setHeader("Content-Type", this.responseType || "application/octet-stream");
    if (this.responseBody)
        this.response.write(this.responseBody, "utf8");
    this.response.end();
}

exports.prototype.execHooks = async function(name) {
    if (this.server.hooks[name]) {
        for (const func of this.server.hooks[name]) {
            await func(this)
        }
    }
}

Object.defineProperty(exports.prototype, "requestBody", {
    get: function() {
        if (this.$requestBody === undefined) {
            if (this.server.hooks.getRequestBody !== undefined) {
                this.$requestBody = this.server.hooks.getRequestBody.reduce(
                    (body, func) => func(body),
                    this.requestText
                );
            }
            else {
                this.$requestBody = this.requestText;
            }
        }
        return this.$requestBody;
    }
});

Object.defineProperty(exports.prototype, "requestType", {
    get: function() {
        if (this.$requestType === undefined) {
            this.$requestType = null;
            if (this.request.headers['content-type']) {
                this.$requestType = {
                    'name': null,
                    'options': {}
                };
                this.$requestType.name = this.request.headers['content-type'].replace(/;\s*([^;=]*)\s*=\s*([^;]*)\s*/g, function(m, p1, p2) {
                    if (p1.length)
                        this.$requestType.options[p1] = p2;
                    return "";
                }.bind(this));
            }
        }
        return this.$requestType;
    }
});
