"use strict";

var fs = require("fs").promises;
var path = require("path");

var HttpError = require("@tarp/httpd/HttpError");

module.exports = exports = function(root) {
    this.root = root;
}

exports.prototype.GET = async function(session) {
    try {
        var filepath = path.resolve(this.root + path.normalize(session.url.pathname.replace(/\/$/, "/index.html")));
        return await fs.readFile(filepath);
    }
    catch (e) {
      if (e.code === 'ENOENT') {
          throw new HttpError(404, "file not found");
      } else {
          console.error(e)
          throw new HttpError(500, "internal server error");
      }
    }
}
