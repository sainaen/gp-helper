const {sws, inses} = require("./gp-helper-data");
exports.inses = inses;

function findSW(bytes) {
    var generic;
    for (var i = 0; i < sws.length; i++) {
        if (sws[i].sw1 === bytes[0]) {
            if (sws[i].sw2 === bytes[1]) {
                return sws[i];
            }
            if (!sws[i].sw2) {
                generic = sws[i];
            }
        }
    }
    if (generic) {
        return generic;
    }
    throw new Error("Unknown SW!");
}

function isByteString(str) {
    return str.length % 2 == 0 && /^[0-9a-fA-F]+$/.test(str);
}
exports.isByteString = isByteString;

function splitIntoBytes(str) {
    var result = [];
    while (str) {
        result.push(parseInt(str.substr(0, 2), 16));
        str = str.substr(2);
    }
    return result;
}
exports.splitIntoBytes = splitIntoBytes;

function isSW(bytes) {
    return bytes.length == 2;
}
exports.isSW = isSW;

function isGpAPDU(bytes) {
    return bytes[0] & 0x80 && bytes.length > 4;
}
exports.isGpAPDU = isGpAPDU;

function isSelectAPDU(bytes) {
    return bytes[0] == 0 && bytes[1] == 0xA4 && bytes[2] == 0x04;
}
exports.isSelectAPDU = isSelectAPDU;

function isINS(bytes) {
    return bytes.length == 1 && inses[bytes[0]] != null;
}
exports.isINS = isINS;

function formTokenizedAPDU(str) {
    var knownTokens = {
        INS: {id: "ins"},
        CLA: {id: "cla"},
        DATA: {id: "data", long: true},
        D: {id: "data", long: true},
        MAC: {id: "mac", long: true},
        LE: {id: "le"},
        P1: {id: "p1"},
        P2: {id: "p2"},
        LC: {id: "lc"}
    };
    return str.toUpperCase().split(/\s+/g).map(function sanitize(token) {
        return token.replace("0X", "").replace(/[,.;]+/g, "").trim();
    }).reduce(function parse(result, token) {
        if (token.indexOf(":") == -1) {
            console.warn("Wrong token", token);
            return result;
        }
        var parsedToken = token.split(":");
        if (parsedToken[0] in knownTokens) {
            var tokenProp = knownTokens[parsedToken[0]];
            if (tokenProp.id in result) {
                console.warn("Duplicate token", tokenProp.id);
            }
            result[tokenProp.id] = (tokenProp.long ? splitIntoBytes(parsedToken[1]) : parseInt(parsedToken[1], 16));
        } else {
            console.warn("Unknown token", parsedToken[0])
        }
        return result;
    }, {});
}
exports.formTokenizedAPDU = formTokenizedAPDU;

function formAPDU(bytes) {
    var apdu = {};
    if (!bytes[0] || (bytes[0] & 0x80) == 0) {
        throw new Error("Not a GP Card Command!");
    }
    apdu.cla = bytes[0];
    if ((bytes[0] & 0x04) != 0) {
        apdu.security = true;
    }
    apdu.ins = bytes[1];
    apdu.p1 = bytes[2];
    apdu.p2 = bytes[3];
    apdu.lc = bytes[4];
    if (apdu.security) {
        // mac is included in Lc
        apdu.mac = bytes.slice(5 + apdu.lc - 8, 5 + apdu.lc);
    }
    apdu.data = bytes.slice(5, 5 + apdu.lc - (apdu.mac ? apdu.mac.length : 0));
    var additionalLen = bytes.length - 5 - apdu.lc;
    if (additionalLen > 1) {
        throw new Error("Wrong Lc!");
    }
    if (additionalLen == 1) {
        apdu.le = bytes[5 + apdu.lc + (apdu.mac ? apdu.mac.length : 0)];
    }
    return apdu;
}
exports.formAPDU = formAPDU;

function formatByteSimple(byte) {
    var digits = "0123456789ABCDEF";
    return digits.charAt(byte >> 4) + digits.charAt(byte & 0x0F);
}

function formatByte(byte) {
    return "0x" + formatByteSimple(byte);
}
exports.formatByte = formatByte;

function padToByte(n) {
    while (n.length < 8) {
        n = "0" + n;
    }
    return n;
}

function formatBitset(byte) {
    return formatByte(byte) + (byte ? " (bits set: " + padToByte(byte.toString(2)).split("").reverse().reduce(function (result, bit, idx) {
            if (bit == "1") {
                result += (result.length > 0 ? ", " : "") + idx;
            }
            return result;
        }, "") + ")" : " (bits set: none)");
}

function formatByteArray(bytes) {
    if (bytes.length > 14) {
        return "[" + bytes.slice(0, 8).map(formatByte).join(", ") + ", <a class='more' style='cursor: pointer' data-bytes='" + JSON.stringify(bytes.slice(8, -4)) + "'>...</a>, " + bytes.slice(-4).map(formatByte).join(", ") + "] (len: " + bytes.length + ")";
    }
    return "[" + bytes.map(formatByte).join(", ") + "] (len: " + bytes.length + ")";
}

function formatINS(byte) {
    var name = inses[byte];
    return formatByte(byte) + " (" + (name || "Unknown INS") + ")";
}

function formatGenericAPDU(apdu) {
    var text =
        (apdu.cla != null ? "\n\tCLA:\t" + formatByte(apdu.cla) : "") +
        (apdu.ins != null ? "\n\tINS:\t" + formatINS(apdu.ins) : "") +
        (apdu.p1 != null ? "\n\tP1:\t" + formatBitset(apdu.p1) : "") +
        (apdu.p2 != null ? "\n\tP2:\t" + formatBitset(apdu.p2) : "") +
        (apdu.lc != null ? "\n\tLc:\t" + formatByte(apdu.lc) + " (" + apdu.lc + ")" : "") +
        (apdu.data != null ? "\n\tData:\t" + formatByteArray(apdu.data) : "");
    if ("mac" in apdu) {
        text += "\n\tMAC:\t" + formatByteArray(apdu.mac);
    }
    if ("le" in apdu) {
        text += "\n\tLe:\t" + formatByte(apdu.le)
    }
    return text;
}

function formatAPDU(apdu) {
    var knownAPDUFormaters = {
        0x82: function (extAuthApdu) {
            var description = "\n\t<b>Description:</b> External Authenticate command which will authenticate host on the card<br/>\t\t     and set " +
                (extAuthApdu.p1 == 0x03 ? "the third security level (encryption + MAC)" : "the first security level (only MAC)") +
                " for the next APDUs.";
            return description + "\n" + formatGenericAPDU(apdu);
        }
    };

    return (knownAPDUFormaters[apdu.ins] ? knownAPDUFormaters[apdu.ins](apdu) : formatGenericAPDU(apdu));
}
exports.formatAPDU = formatAPDU;

function formatSW(bytes) {
    return findSW(bytes).title;
}
exports.formatSW = formatSW;

function formatAID(bytes) {
    return bytes.map(formatByteSimple).join("");
}

function formatSelectAPDU(bytes) {
    var lc = bytes[4];
    return "Select AID " + formatAID(bytes.slice(5, 5+lc));
}
exports.formatSelectAPDU = formatSelectAPDU;

function isTokenizedAPDU(str) {
    var capitalizedStr = str.toUpperCase();
    return !!(capitalizedStr.indexOf("INS:") > -1
    || capitalizedStr.indexOf("CLA:") > -1
    || capitalizedStr.indexOf("DATA:") > -1
    || capitalizedStr.indexOf("MAC:") > -1
    || capitalizedStr.indexOf("LC:") > -1
    || capitalizedStr.indexOf("P1:") > -1
    || capitalizedStr.indexOf("P2:") > -1);
}
exports.isTokenizedAPDU = isTokenizedAPDU;
