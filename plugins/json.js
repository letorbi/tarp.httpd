var HttpError = require("../HttpError");

function end(session) {
    if (typeof session.responseBody === "object") {
        session.responseBody = JSON.stringify(session.responseBody);
        session.responseType = "application/json;charset=UTF-8";
    }
}

function parseRequest(body) {
    try {
        return body ? JSON.parse(body) : null;
    }
    catch (e) {
        throw new HttpError(400, "invalid JSON", null, e);
    }
}

function validateObject(obj, template, chain) {
    if (typeof obj !== "object") {
        throw new HttpError(400, `Key is not an object: ${chain}`);
    }
    var templateKeys = Object.keys(template);
    for (let key of templateKeys) {
        if (!Object.hasOwn(obj, key)) {
            throw new HttpError(400, `Key is missing: ${chain}.${key}`);
        }
        if (typeof template[key] === "object") {
            if (Array.isArray(template[key]))
                validateArray(obj[key], template[key], `${chain}.${key}`);
            else
                validateObject(obj[key], template[key], `${chain}.${key}`);
        }
        else if (typeof obj[key] != template[key]) {
            throw new HttpError(400, `Key is not of type ${template[key]}: ${chain}.${key}`);
        }
    }
}

function validateArray(arr, template, chain) {
    if (!Array.isArray(arr)) {
        throw new HttpError(400, `Key is not an array: ${chain}`);
    }
    for (let idx = 0; idx < arr.length; idx++) {
        if (typeof template[0] === "object") {
            if (Array.isArray(template[0]))
                validateArray(arr[idx], template[0], `${chain}.${idx}`);
            else
                validateObject(arr[idx], template[0], `${chain}.${idx}`);
        }
        else if (typeof arr[idx] != template[0]) {
            throw new HttpError(400, `Key is not of type ${template[0]}: ${chain}.${idx}`);
        }
    }
}

function validate(session, template) {
    if (Array.isArray(template))
        validateArray(session.requestBody, template, "JSON");
    else
        validateObject(session.requestBody, template, "JSON");
};

exports.hooks = { end, parseRequest };
exports.validate = validate;
