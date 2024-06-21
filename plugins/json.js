exports.parseRequest = function(body) {
    try {
        return body ? JSON.parse(body) : null;
    }
    catch (e) {
        throw new HttpError(400, "invalid JSON request", null, e);
    }
}

exports.parseResponse = function(code, body, type) {
    return [code, JSON.stringify(body), "application/json;charset=UTF-8"];
}
