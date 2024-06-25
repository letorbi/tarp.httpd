exports.end = function(session) {
    if (typeof session.responseBody === "object") {
        session.responseBody = JSON.stringify(session.responseBody);
        session.responseType = "application/json;charset=UTF-8";
    }
}

exports.parseRequest = function(body) {
    try {
        return body ? JSON.parse(body) : null;
    }
    catch (e) {
        throw new HttpError(400, "invalid JSON request", null, e);
    }
}
