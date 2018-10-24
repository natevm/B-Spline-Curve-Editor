function cleanArray(actual) {
    var newArray = new Array();
    for (var i = 0; i < actual.length; i++) {
        var temp = actual[i].trim()
        if (temp.indexOf('#') != -1) {
            temp = temp.substring(0, temp.indexOf('#'));
        }
        if (temp && temp.length >= 1) {
            newArray.push(temp);
        }
    }
    return newArray;
}

function assert(condition, message) {
    if (!condition) {
        message = message || "Assertion failed";
        if (typeof Error !== "undefined") {
            throw new Error(message);
        }
        throw message; // Fallback
    }
}