"use strict";

module.exports = exports = function(code, message, data) {
    Error.call(this);
    this.name = "TARP_HTTPD_ERROR";
    this.code = code;
    this.message = message;
    this.data = data;
}

exports.prototype = Object.create(Error.prototype);

exports.prototype.toString = function() {
    return `${this.code} ${this.message}`;
}
