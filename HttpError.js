"use strict";

module.exports = exports = function(code, message, data, exception) {
    Error.call(this);
    this.name = "TARP_HTTPD_ERROR";
    this.code = code||500;
    this.message = message||"";
    this.data = data||null;
    this.exception = exception||null;
}

exports.prototype = Object.create(Error.prototype);

exports.prototype.toString = function() {
    return this.code+" ("+this.message+")";
}
