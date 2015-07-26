(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var data = require("./data");
var sws = data.sws;
var inses = data.inses;

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

function splitIntoBytes(str) {
    var result = [];
    while (str) {
        result.push(parseInt(str.substr(0, 2), 16));
        str = str.substr(2);
    }
    return result;
}

function isSW(bytes) {
    return bytes.length == 2;
}

function isGpAPDU(bytes) {
    return bytes[0] & 0x80 && bytes.length > 4;
}

function isSelectAPDU(bytes) {
    return bytes[0] == 0 && bytes[1] == 0xA4 && bytes[2] == 0x04;
}

function isINS(bytes) {
    return bytes.length == 1 && inses[bytes[0]] != null;
}

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

function formatByteSimple(byte) {
    var digits = "0123456789ABCDEF";
    return digits.charAt(byte >> 4) + digits.charAt(byte & 0x0F);
}

function formatByte(byte) {
    return "0x" + formatByteSimple(byte);
}

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

function formatSW(bytes) {
    return findSW(bytes).title;
}

function formatAID(bytes) {
    return bytes.map(formatByteSimple).join("");
}

function formatSelectAPDU(bytes) {
    var lc = bytes[4];
    return "Select AID " + formatAID(bytes.slice(5, 5+lc));
}

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

function render(inStr) {
    inStr = inStr.trim();
    if (!inStr) {
        throw "Empty input!";
    }
    if (isTokenizedAPDU(inStr)) {
        return "APDU (parts): " + formatAPDU(formTokenizedAPDU(inStr)) + "\n";
    }
    if (!isByteString(inStr)) {
        throw "Not a ByteString!";
    }
    var bytes = splitIntoBytes(inStr);
    if (isGpAPDU(bytes)) {
        return "APDU: " + formatAPDU(formAPDU(bytes)) + "\n";
    }
    if (isSelectAPDU(bytes)) {
        return "APDU: " + formatSelectAPDU(bytes) + "\n";
    }
    if (isSW(bytes)) {
        return "Status Word: " + formatSW(bytes) + "\n";
    }
    if (isINS(bytes)) {
        return "GP Command: " + inses[bytes[0]] + "\n";
    }
    throw "Unknown input!";
}

$(function () {
    // onload
    var $in = $("#in");
    var $out = $("#out");
    var $inForm = $("#inForm");
    $inForm.on("submit", function (e) {
        e.preventDefault();
        var inStr = $in.val();
        try {
            $out.html(render(inStr));
            location.replace(window.location.href.split('#')[0] + '#' + inStr);
        } catch (ex) {
            console.error(ex);
            $out.html(ex);
        }
    });
    $out.on("click", ".more", function (e) {
        var $more = $(e.target);
        var bytes = $more.data("bytes");
        $more.replaceWith(bytes.map(formatByte).join(", "));
    });
    $(window).on("hashchange", function (e) {
        if (window.location.hash) {
            var newVal = window.location.hash.substr(1);
            if ($in.val() !== newVal) {
                $in.val(newVal);
                $inForm.submit();
            }
        }
    });
    if (window.location.hash) {
        $in.val(window.location.hash.substr(1));
        $inForm.submit();
    }
});

},{"./data":2}],2:[function(require,module,exports){
module.exports = {
    inses: {
        0x22: "Manage Security Environment",
        0x2A: "Perform Security Operation [decipher]",
        0x50: "Initialize Update",
        0x70: "Manage Channel",
        0x78: "End R-MAC Session",
        0x7A: "Begin R-MAC Session",
        0x82: "External Authenticate",
        0x84: "Get Challenge",
        0x88: "Internal Authenticate",
        0xA4: "Select",
        0xCA: "Get Data",
        0xCB: "Get Data",
        0xD8: "Put Key",
        0xE2: "Store Data",
        0xE4: "Delete",
        0xE6: "Install",
        0xE8: "Load",
        0xF0: "Set Status",
        0xF2: "Get Status"
    },
    sws: [
        {sw1: 0x90, sw2: 0x00, title: "Success"},
        {sw1: 0x61,            title: "Response data incomplete, more bytes available"},
        {sw1: 0x62, sw2: 0x00, title: "Logical Channel already closed"},
        {sw1: 0x62, sw2: 0x83, title: "Card Life Cycle State is CARD_LOCKED"},
        {sw1: 0x63, sw2: 0x00, title: "External auth: Authentication of host cryptogram failed, or Verification of certificate failed"},
        {sw1: 0x63, sw2: 0x10, title: "More data available"},
        {sw1: 0x64, sw2: 0x00, title: "No specific diagnosis"},
        {sw1: 0x65, sw2: 0x81, title: "Memory failure"},
        {sw1: 0x67, sw2: 0x00, title: "Wrong length in Lc"},
        {sw1: 0x68, sw2: 0x81, title: "Logical channel not supported or is not active"},
        {sw1: 0x68, sw2: 0x82, title: "Secure messaging not supported"},
        {sw1: 0x68, sw2: 0x83, title: "The last command of the chain was expected"},
        {sw1: 0x69, sw2: 0x82, title: "Security status not satisfied"},
        {sw1: 0x69, sw2: 0x85, title: "Conditions of use not satisfied"},
        {sw1: 0x6A, sw2: 0x80, title: "Incorrect values in command data"},
        {sw1: 0x6A, sw2: 0x81, title: "Function not supported e.g. card Life Cycle State is CARD_LOCKED"},
        {sw1: 0x6A, sw2: 0x82, title: "Application/file not found"},
        {sw1: 0x6A, sw2: 0x84, title: "Not enough memory space"},
        {sw1: 0x6A, sw2: 0x86, title: "Incorrect P1 P2"},
        {sw1: 0x6A, sw2: 0x88, title: "Referenced data not found"},
        {sw1: 0x6D, sw2: 0x00, title: "Instruction not supported or invalid"},
        {sw1: 0x6E, sw2: 0x00, title: "Invalid class"},
        {sw1: 0x6F, sw2: 0x00, title: "No specific diagnosis error (typically low level error, e.g. runtime exception)"},
        {sw1: 0x94, sw2: 0x84, title: "Algorithm not supported"},
        {sw1: 0x94, sw2: 0x85, title: "Invalid key check value"}
    ]
};

},{}]},{},[1])
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMvanMvYXBwLmpzIiwic3JjL2pzL2RhdGEuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pRQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwidmFyIGRhdGEgPSByZXF1aXJlKFwiLi9kYXRhXCIpO1xudmFyIHN3cyA9IGRhdGEuc3dzO1xudmFyIGluc2VzID0gZGF0YS5pbnNlcztcblxuZnVuY3Rpb24gZmluZFNXKGJ5dGVzKSB7XG4gICAgdmFyIGdlbmVyaWM7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBzd3MubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgaWYgKHN3c1tpXS5zdzEgPT09IGJ5dGVzWzBdKSB7XG4gICAgICAgICAgICBpZiAoc3dzW2ldLnN3MiA9PT0gYnl0ZXNbMV0pIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gc3dzW2ldO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKCFzd3NbaV0uc3cyKSB7XG4gICAgICAgICAgICAgICAgZ2VuZXJpYyA9IHN3c1tpXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbiAgICBpZiAoZ2VuZXJpYykge1xuICAgICAgICByZXR1cm4gZ2VuZXJpYztcbiAgICB9XG4gICAgdGhyb3cgbmV3IEVycm9yKFwiVW5rbm93biBTVyFcIik7XG59XG5cbmZ1bmN0aW9uIGlzQnl0ZVN0cmluZyhzdHIpIHtcbiAgICByZXR1cm4gc3RyLmxlbmd0aCAlIDIgPT0gMCAmJiAvXlswLTlhLWZBLUZdKyQvLnRlc3Qoc3RyKTtcbn1cblxuZnVuY3Rpb24gc3BsaXRJbnRvQnl0ZXMoc3RyKSB7XG4gICAgdmFyIHJlc3VsdCA9IFtdO1xuICAgIHdoaWxlIChzdHIpIHtcbiAgICAgICAgcmVzdWx0LnB1c2gocGFyc2VJbnQoc3RyLnN1YnN0cigwLCAyKSwgMTYpKTtcbiAgICAgICAgc3RyID0gc3RyLnN1YnN0cigyKTtcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbn1cblxuZnVuY3Rpb24gaXNTVyhieXRlcykge1xuICAgIHJldHVybiBieXRlcy5sZW5ndGggPT0gMjtcbn1cblxuZnVuY3Rpb24gaXNHcEFQRFUoYnl0ZXMpIHtcbiAgICByZXR1cm4gYnl0ZXNbMF0gJiAweDgwICYmIGJ5dGVzLmxlbmd0aCA+IDQ7XG59XG5cbmZ1bmN0aW9uIGlzU2VsZWN0QVBEVShieXRlcykge1xuICAgIHJldHVybiBieXRlc1swXSA9PSAwICYmIGJ5dGVzWzFdID09IDB4QTQgJiYgYnl0ZXNbMl0gPT0gMHgwNDtcbn1cblxuZnVuY3Rpb24gaXNJTlMoYnl0ZXMpIHtcbiAgICByZXR1cm4gYnl0ZXMubGVuZ3RoID09IDEgJiYgaW5zZXNbYnl0ZXNbMF1dICE9IG51bGw7XG59XG5cbmZ1bmN0aW9uIGZvcm1Ub2tlbml6ZWRBUERVKHN0cikge1xuICAgIHZhciBrbm93blRva2VucyA9IHtcbiAgICAgICAgSU5TOiB7aWQ6IFwiaW5zXCJ9LFxuICAgICAgICBDTEE6IHtpZDogXCJjbGFcIn0sXG4gICAgICAgIERBVEE6IHtpZDogXCJkYXRhXCIsIGxvbmc6IHRydWV9LFxuICAgICAgICBEOiB7aWQ6IFwiZGF0YVwiLCBsb25nOiB0cnVlfSxcbiAgICAgICAgTUFDOiB7aWQ6IFwibWFjXCIsIGxvbmc6IHRydWV9LFxuICAgICAgICBMRToge2lkOiBcImxlXCJ9LFxuICAgICAgICBQMToge2lkOiBcInAxXCJ9LFxuICAgICAgICBQMjoge2lkOiBcInAyXCJ9LFxuICAgICAgICBMQzoge2lkOiBcImxjXCJ9XG4gICAgfTtcbiAgICByZXR1cm4gc3RyLnRvVXBwZXJDYXNlKCkuc3BsaXQoL1xccysvZykubWFwKGZ1bmN0aW9uIHNhbml0aXplKHRva2VuKSB7XG4gICAgICAgIHJldHVybiB0b2tlbi5yZXBsYWNlKFwiMFhcIiwgXCJcIikucmVwbGFjZSgvWywuO10rL2csIFwiXCIpLnRyaW0oKTtcbiAgICB9KS5yZWR1Y2UoZnVuY3Rpb24gcGFyc2UocmVzdWx0LCB0b2tlbikge1xuICAgICAgICBpZiAodG9rZW4uaW5kZXhPZihcIjpcIikgPT0gLTEpIHtcbiAgICAgICAgICAgIGNvbnNvbGUud2FybihcIldyb25nIHRva2VuXCIsIHRva2VuKTtcbiAgICAgICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICAgIH1cbiAgICAgICAgdmFyIHBhcnNlZFRva2VuID0gdG9rZW4uc3BsaXQoXCI6XCIpO1xuICAgICAgICBpZiAocGFyc2VkVG9rZW5bMF0gaW4ga25vd25Ub2tlbnMpIHtcbiAgICAgICAgICAgIHZhciB0b2tlblByb3AgPSBrbm93blRva2Vuc1twYXJzZWRUb2tlblswXV07XG4gICAgICAgICAgICBpZiAodG9rZW5Qcm9wLmlkIGluIHJlc3VsdCkge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUud2FybihcIkR1cGxpY2F0ZSB0b2tlblwiLCB0b2tlblByb3AuaWQpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmVzdWx0W3Rva2VuUHJvcC5pZF0gPSAodG9rZW5Qcm9wLmxvbmcgPyBzcGxpdEludG9CeXRlcyhwYXJzZWRUb2tlblsxXSkgOiBwYXJzZUludChwYXJzZWRUb2tlblsxXSwgMTYpKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNvbnNvbGUud2FybihcIlVua25vd24gdG9rZW5cIiwgcGFyc2VkVG9rZW5bMF0pXG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9LCB7fSk7XG59XG5cbmZ1bmN0aW9uIGZvcm1BUERVKGJ5dGVzKSB7XG4gICAgdmFyIGFwZHUgPSB7fTtcbiAgICBpZiAoIWJ5dGVzWzBdIHx8IChieXRlc1swXSAmIDB4ODApID09IDApIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiTm90IGEgR1AgQ2FyZCBDb21tYW5kIVwiKTtcbiAgICB9XG4gICAgYXBkdS5jbGEgPSBieXRlc1swXTtcbiAgICBpZiAoKGJ5dGVzWzBdICYgMHgwNCkgIT0gMCkge1xuICAgICAgICBhcGR1LnNlY3VyaXR5ID0gdHJ1ZTtcbiAgICB9XG4gICAgYXBkdS5pbnMgPSBieXRlc1sxXTtcbiAgICBhcGR1LnAxID0gYnl0ZXNbMl07XG4gICAgYXBkdS5wMiA9IGJ5dGVzWzNdO1xuICAgIGFwZHUubGMgPSBieXRlc1s0XTtcbiAgICBpZiAoYXBkdS5zZWN1cml0eSkge1xuICAgICAgICAvLyBtYWMgaXMgaW5jbHVkZWQgaW4gTGNcbiAgICAgICAgYXBkdS5tYWMgPSBieXRlcy5zbGljZSg1ICsgYXBkdS5sYyAtIDgsIDUgKyBhcGR1LmxjKTtcbiAgICB9XG4gICAgYXBkdS5kYXRhID0gYnl0ZXMuc2xpY2UoNSwgNSArIGFwZHUubGMgLSAoYXBkdS5tYWMgPyBhcGR1Lm1hYy5sZW5ndGggOiAwKSk7XG4gICAgdmFyIGFkZGl0aW9uYWxMZW4gPSBieXRlcy5sZW5ndGggLSA1IC0gYXBkdS5sYztcbiAgICBpZiAoYWRkaXRpb25hbExlbiA+IDEpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiV3JvbmcgTGMhXCIpO1xuICAgIH1cbiAgICBpZiAoYWRkaXRpb25hbExlbiA9PSAxKSB7XG4gICAgICAgIGFwZHUubGUgPSBieXRlc1s1ICsgYXBkdS5sYyArIChhcGR1Lm1hYyA/IGFwZHUubWFjLmxlbmd0aCA6IDApXTtcbiAgICB9XG4gICAgcmV0dXJuIGFwZHU7XG59XG5cbmZ1bmN0aW9uIGZvcm1hdEJ5dGVTaW1wbGUoYnl0ZSkge1xuICAgIHZhciBkaWdpdHMgPSBcIjAxMjM0NTY3ODlBQkNERUZcIjtcbiAgICByZXR1cm4gZGlnaXRzLmNoYXJBdChieXRlID4+IDQpICsgZGlnaXRzLmNoYXJBdChieXRlICYgMHgwRik7XG59XG5cbmZ1bmN0aW9uIGZvcm1hdEJ5dGUoYnl0ZSkge1xuICAgIHJldHVybiBcIjB4XCIgKyBmb3JtYXRCeXRlU2ltcGxlKGJ5dGUpO1xufVxuXG5mdW5jdGlvbiBwYWRUb0J5dGUobikge1xuICAgIHdoaWxlIChuLmxlbmd0aCA8IDgpIHtcbiAgICAgICAgbiA9IFwiMFwiICsgbjtcbiAgICB9XG4gICAgcmV0dXJuIG47XG59XG5cbmZ1bmN0aW9uIGZvcm1hdEJpdHNldChieXRlKSB7XG4gICAgcmV0dXJuIGZvcm1hdEJ5dGUoYnl0ZSkgKyAoYnl0ZSA/IFwiIChiaXRzIHNldDogXCIgKyBwYWRUb0J5dGUoYnl0ZS50b1N0cmluZygyKSkuc3BsaXQoXCJcIikucmV2ZXJzZSgpLnJlZHVjZShmdW5jdGlvbiAocmVzdWx0LCBiaXQsIGlkeCkge1xuICAgICAgICAgICAgaWYgKGJpdCA9PSBcIjFcIikge1xuICAgICAgICAgICAgICAgIHJlc3VsdCArPSAocmVzdWx0Lmxlbmd0aCA+IDAgPyBcIiwgXCIgOiBcIlwiKSArIGlkeDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICAgIH0sIFwiXCIpICsgXCIpXCIgOiBcIiAoYml0cyBzZXQ6IG5vbmUpXCIpO1xufVxuXG5mdW5jdGlvbiBmb3JtYXRCeXRlQXJyYXkoYnl0ZXMpIHtcbiAgICBpZiAoYnl0ZXMubGVuZ3RoID4gMTQpIHtcbiAgICAgICAgcmV0dXJuIFwiW1wiICsgYnl0ZXMuc2xpY2UoMCwgOCkubWFwKGZvcm1hdEJ5dGUpLmpvaW4oXCIsIFwiKSArIFwiLCA8YSBjbGFzcz0nbW9yZScgc3R5bGU9J2N1cnNvcjogcG9pbnRlcicgZGF0YS1ieXRlcz0nXCIgKyBKU09OLnN0cmluZ2lmeShieXRlcy5zbGljZSg4LCAtNCkpICsgXCInPi4uLjwvYT4sIFwiICsgYnl0ZXMuc2xpY2UoLTQpLm1hcChmb3JtYXRCeXRlKS5qb2luKFwiLCBcIikgKyBcIl0gKGxlbjogXCIgKyBieXRlcy5sZW5ndGggKyBcIilcIjtcbiAgICB9XG4gICAgcmV0dXJuIFwiW1wiICsgYnl0ZXMubWFwKGZvcm1hdEJ5dGUpLmpvaW4oXCIsIFwiKSArIFwiXSAobGVuOiBcIiArIGJ5dGVzLmxlbmd0aCArIFwiKVwiO1xufVxuXG5mdW5jdGlvbiBmb3JtYXRJTlMoYnl0ZSkge1xuICAgIHZhciBuYW1lID0gaW5zZXNbYnl0ZV07XG4gICAgcmV0dXJuIGZvcm1hdEJ5dGUoYnl0ZSkgKyBcIiAoXCIgKyAobmFtZSB8fCBcIlVua25vd24gSU5TXCIpICsgXCIpXCI7XG59XG5cbmZ1bmN0aW9uIGZvcm1hdEdlbmVyaWNBUERVKGFwZHUpIHtcbiAgICB2YXIgdGV4dCA9XG4gICAgICAgIChhcGR1LmNsYSAhPSBudWxsID8gXCJcXG5cXHRDTEE6XFx0XCIgKyBmb3JtYXRCeXRlKGFwZHUuY2xhKSA6IFwiXCIpICtcbiAgICAgICAgKGFwZHUuaW5zICE9IG51bGwgPyBcIlxcblxcdElOUzpcXHRcIiArIGZvcm1hdElOUyhhcGR1LmlucykgOiBcIlwiKSArXG4gICAgICAgIChhcGR1LnAxICE9IG51bGwgPyBcIlxcblxcdFAxOlxcdFwiICsgZm9ybWF0Qml0c2V0KGFwZHUucDEpIDogXCJcIikgK1xuICAgICAgICAoYXBkdS5wMiAhPSBudWxsID8gXCJcXG5cXHRQMjpcXHRcIiArIGZvcm1hdEJpdHNldChhcGR1LnAyKSA6IFwiXCIpICtcbiAgICAgICAgKGFwZHUubGMgIT0gbnVsbCA/IFwiXFxuXFx0TGM6XFx0XCIgKyBmb3JtYXRCeXRlKGFwZHUubGMpICsgXCIgKFwiICsgYXBkdS5sYyArIFwiKVwiIDogXCJcIikgK1xuICAgICAgICAoYXBkdS5kYXRhICE9IG51bGwgPyBcIlxcblxcdERhdGE6XFx0XCIgKyBmb3JtYXRCeXRlQXJyYXkoYXBkdS5kYXRhKSA6IFwiXCIpO1xuICAgIGlmIChcIm1hY1wiIGluIGFwZHUpIHtcbiAgICAgICAgdGV4dCArPSBcIlxcblxcdE1BQzpcXHRcIiArIGZvcm1hdEJ5dGVBcnJheShhcGR1Lm1hYyk7XG4gICAgfVxuICAgIGlmIChcImxlXCIgaW4gYXBkdSkge1xuICAgICAgICB0ZXh0ICs9IFwiXFxuXFx0TGU6XFx0XCIgKyBmb3JtYXRCeXRlKGFwZHUubGUpXG4gICAgfVxuICAgIHJldHVybiB0ZXh0O1xufVxuXG5mdW5jdGlvbiBmb3JtYXRBUERVKGFwZHUpIHtcbiAgICB2YXIga25vd25BUERVRm9ybWF0ZXJzID0ge1xuICAgICAgICAweDgyOiBmdW5jdGlvbiAoZXh0QXV0aEFwZHUpIHtcbiAgICAgICAgICAgIHZhciBkZXNjcmlwdGlvbiA9IFwiXFxuXFx0PGI+RGVzY3JpcHRpb246PC9iPiBFeHRlcm5hbCBBdXRoZW50aWNhdGUgY29tbWFuZCB3aGljaCB3aWxsIGF1dGhlbnRpY2F0ZSBob3N0IG9uIHRoZSBjYXJkPGJyLz5cXHRcXHQgICAgIGFuZCBzZXQgXCIgK1xuICAgICAgICAgICAgICAgIChleHRBdXRoQXBkdS5wMSA9PSAweDAzID8gXCJ0aGUgdGhpcmQgc2VjdXJpdHkgbGV2ZWwgKGVuY3J5cHRpb24gKyBNQUMpXCIgOiBcInRoZSBmaXJzdCBzZWN1cml0eSBsZXZlbCAob25seSBNQUMpXCIpICtcbiAgICAgICAgICAgICAgICBcIiBmb3IgdGhlIG5leHQgQVBEVXMuXCI7XG4gICAgICAgICAgICByZXR1cm4gZGVzY3JpcHRpb24gKyBcIlxcblwiICsgZm9ybWF0R2VuZXJpY0FQRFUoYXBkdSk7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgcmV0dXJuIChrbm93bkFQRFVGb3JtYXRlcnNbYXBkdS5pbnNdID8ga25vd25BUERVRm9ybWF0ZXJzW2FwZHUuaW5zXShhcGR1KSA6IGZvcm1hdEdlbmVyaWNBUERVKGFwZHUpKTtcbn1cblxuZnVuY3Rpb24gZm9ybWF0U1coYnl0ZXMpIHtcbiAgICByZXR1cm4gZmluZFNXKGJ5dGVzKS50aXRsZTtcbn1cblxuZnVuY3Rpb24gZm9ybWF0QUlEKGJ5dGVzKSB7XG4gICAgcmV0dXJuIGJ5dGVzLm1hcChmb3JtYXRCeXRlU2ltcGxlKS5qb2luKFwiXCIpO1xufVxuXG5mdW5jdGlvbiBmb3JtYXRTZWxlY3RBUERVKGJ5dGVzKSB7XG4gICAgdmFyIGxjID0gYnl0ZXNbNF07XG4gICAgcmV0dXJuIFwiU2VsZWN0IEFJRCBcIiArIGZvcm1hdEFJRChieXRlcy5zbGljZSg1LCA1K2xjKSk7XG59XG5cbmZ1bmN0aW9uIGlzVG9rZW5pemVkQVBEVShzdHIpIHtcbiAgICB2YXIgY2FwaXRhbGl6ZWRTdHIgPSBzdHIudG9VcHBlckNhc2UoKTtcbiAgICByZXR1cm4gISEoY2FwaXRhbGl6ZWRTdHIuaW5kZXhPZihcIklOUzpcIikgPiAtMVxuICAgIHx8IGNhcGl0YWxpemVkU3RyLmluZGV4T2YoXCJDTEE6XCIpID4gLTFcbiAgICB8fCBjYXBpdGFsaXplZFN0ci5pbmRleE9mKFwiREFUQTpcIikgPiAtMVxuICAgIHx8IGNhcGl0YWxpemVkU3RyLmluZGV4T2YoXCJNQUM6XCIpID4gLTFcbiAgICB8fCBjYXBpdGFsaXplZFN0ci5pbmRleE9mKFwiTEM6XCIpID4gLTFcbiAgICB8fCBjYXBpdGFsaXplZFN0ci5pbmRleE9mKFwiUDE6XCIpID4gLTFcbiAgICB8fCBjYXBpdGFsaXplZFN0ci5pbmRleE9mKFwiUDI6XCIpID4gLTEpO1xufVxuXG5mdW5jdGlvbiByZW5kZXIoaW5TdHIpIHtcbiAgICBpblN0ciA9IGluU3RyLnRyaW0oKTtcbiAgICBpZiAoIWluU3RyKSB7XG4gICAgICAgIHRocm93IFwiRW1wdHkgaW5wdXQhXCI7XG4gICAgfVxuICAgIGlmIChpc1Rva2VuaXplZEFQRFUoaW5TdHIpKSB7XG4gICAgICAgIHJldHVybiBcIkFQRFUgKHBhcnRzKTogXCIgKyBmb3JtYXRBUERVKGZvcm1Ub2tlbml6ZWRBUERVKGluU3RyKSkgKyBcIlxcblwiO1xuICAgIH1cbiAgICBpZiAoIWlzQnl0ZVN0cmluZyhpblN0cikpIHtcbiAgICAgICAgdGhyb3cgXCJOb3QgYSBCeXRlU3RyaW5nIVwiO1xuICAgIH1cbiAgICB2YXIgYnl0ZXMgPSBzcGxpdEludG9CeXRlcyhpblN0cik7XG4gICAgaWYgKGlzR3BBUERVKGJ5dGVzKSkge1xuICAgICAgICByZXR1cm4gXCJBUERVOiBcIiArIGZvcm1hdEFQRFUoZm9ybUFQRFUoYnl0ZXMpKSArIFwiXFxuXCI7XG4gICAgfVxuICAgIGlmIChpc1NlbGVjdEFQRFUoYnl0ZXMpKSB7XG4gICAgICAgIHJldHVybiBcIkFQRFU6IFwiICsgZm9ybWF0U2VsZWN0QVBEVShieXRlcykgKyBcIlxcblwiO1xuICAgIH1cbiAgICBpZiAoaXNTVyhieXRlcykpIHtcbiAgICAgICAgcmV0dXJuIFwiU3RhdHVzIFdvcmQ6IFwiICsgZm9ybWF0U1coYnl0ZXMpICsgXCJcXG5cIjtcbiAgICB9XG4gICAgaWYgKGlzSU5TKGJ5dGVzKSkge1xuICAgICAgICByZXR1cm4gXCJHUCBDb21tYW5kOiBcIiArIGluc2VzW2J5dGVzWzBdXSArIFwiXFxuXCI7XG4gICAgfVxuICAgIHRocm93IFwiVW5rbm93biBpbnB1dCFcIjtcbn1cblxuJChmdW5jdGlvbiAoKSB7XG4gICAgLy8gb25sb2FkXG4gICAgdmFyICRpbiA9ICQoXCIjaW5cIik7XG4gICAgdmFyICRvdXQgPSAkKFwiI291dFwiKTtcbiAgICB2YXIgJGluRm9ybSA9ICQoXCIjaW5Gb3JtXCIpO1xuICAgICRpbkZvcm0ub24oXCJzdWJtaXRcIiwgZnVuY3Rpb24gKGUpIHtcbiAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICB2YXIgaW5TdHIgPSAkaW4udmFsKCk7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICAkb3V0Lmh0bWwocmVuZGVyKGluU3RyKSk7XG4gICAgICAgICAgICBsb2NhdGlvbi5yZXBsYWNlKHdpbmRvdy5sb2NhdGlvbi5ocmVmLnNwbGl0KCcjJylbMF0gKyAnIycgKyBpblN0cik7XG4gICAgICAgIH0gY2F0Y2ggKGV4KSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKGV4KTtcbiAgICAgICAgICAgICRvdXQuaHRtbChleCk7XG4gICAgICAgIH1cbiAgICB9KTtcbiAgICAkb3V0Lm9uKFwiY2xpY2tcIiwgXCIubW9yZVwiLCBmdW5jdGlvbiAoZSkge1xuICAgICAgICB2YXIgJG1vcmUgPSAkKGUudGFyZ2V0KTtcbiAgICAgICAgdmFyIGJ5dGVzID0gJG1vcmUuZGF0YShcImJ5dGVzXCIpO1xuICAgICAgICAkbW9yZS5yZXBsYWNlV2l0aChieXRlcy5tYXAoZm9ybWF0Qnl0ZSkuam9pbihcIiwgXCIpKTtcbiAgICB9KTtcbiAgICAkKHdpbmRvdykub24oXCJoYXNoY2hhbmdlXCIsIGZ1bmN0aW9uIChlKSB7XG4gICAgICAgIGlmICh3aW5kb3cubG9jYXRpb24uaGFzaCkge1xuICAgICAgICAgICAgdmFyIG5ld1ZhbCA9IHdpbmRvdy5sb2NhdGlvbi5oYXNoLnN1YnN0cigxKTtcbiAgICAgICAgICAgIGlmICgkaW4udmFsKCkgIT09IG5ld1ZhbCkge1xuICAgICAgICAgICAgICAgICRpbi52YWwobmV3VmFsKTtcbiAgICAgICAgICAgICAgICAkaW5Gb3JtLnN1Ym1pdCgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSk7XG4gICAgaWYgKHdpbmRvdy5sb2NhdGlvbi5oYXNoKSB7XG4gICAgICAgICRpbi52YWwod2luZG93LmxvY2F0aW9uLmhhc2guc3Vic3RyKDEpKTtcbiAgICAgICAgJGluRm9ybS5zdWJtaXQoKTtcbiAgICB9XG59KTtcbiIsIm1vZHVsZS5leHBvcnRzID0ge1xuICAgIGluc2VzOiB7XG4gICAgICAgIDB4MjI6IFwiTWFuYWdlIFNlY3VyaXR5IEVudmlyb25tZW50XCIsXG4gICAgICAgIDB4MkE6IFwiUGVyZm9ybSBTZWN1cml0eSBPcGVyYXRpb24gW2RlY2lwaGVyXVwiLFxuICAgICAgICAweDUwOiBcIkluaXRpYWxpemUgVXBkYXRlXCIsXG4gICAgICAgIDB4NzA6IFwiTWFuYWdlIENoYW5uZWxcIixcbiAgICAgICAgMHg3ODogXCJFbmQgUi1NQUMgU2Vzc2lvblwiLFxuICAgICAgICAweDdBOiBcIkJlZ2luIFItTUFDIFNlc3Npb25cIixcbiAgICAgICAgMHg4MjogXCJFeHRlcm5hbCBBdXRoZW50aWNhdGVcIixcbiAgICAgICAgMHg4NDogXCJHZXQgQ2hhbGxlbmdlXCIsXG4gICAgICAgIDB4ODg6IFwiSW50ZXJuYWwgQXV0aGVudGljYXRlXCIsXG4gICAgICAgIDB4QTQ6IFwiU2VsZWN0XCIsXG4gICAgICAgIDB4Q0E6IFwiR2V0IERhdGFcIixcbiAgICAgICAgMHhDQjogXCJHZXQgRGF0YVwiLFxuICAgICAgICAweEQ4OiBcIlB1dCBLZXlcIixcbiAgICAgICAgMHhFMjogXCJTdG9yZSBEYXRhXCIsXG4gICAgICAgIDB4RTQ6IFwiRGVsZXRlXCIsXG4gICAgICAgIDB4RTY6IFwiSW5zdGFsbFwiLFxuICAgICAgICAweEU4OiBcIkxvYWRcIixcbiAgICAgICAgMHhGMDogXCJTZXQgU3RhdHVzXCIsXG4gICAgICAgIDB4RjI6IFwiR2V0IFN0YXR1c1wiXG4gICAgfSxcbiAgICBzd3M6IFtcbiAgICAgICAge3N3MTogMHg5MCwgc3cyOiAweDAwLCB0aXRsZTogXCJTdWNjZXNzXCJ9LFxuICAgICAgICB7c3cxOiAweDYxLCAgICAgICAgICAgIHRpdGxlOiBcIlJlc3BvbnNlIGRhdGEgaW5jb21wbGV0ZSwgbW9yZSBieXRlcyBhdmFpbGFibGVcIn0sXG4gICAgICAgIHtzdzE6IDB4NjIsIHN3MjogMHgwMCwgdGl0bGU6IFwiTG9naWNhbCBDaGFubmVsIGFscmVhZHkgY2xvc2VkXCJ9LFxuICAgICAgICB7c3cxOiAweDYyLCBzdzI6IDB4ODMsIHRpdGxlOiBcIkNhcmQgTGlmZSBDeWNsZSBTdGF0ZSBpcyBDQVJEX0xPQ0tFRFwifSxcbiAgICAgICAge3N3MTogMHg2Mywgc3cyOiAweDAwLCB0aXRsZTogXCJFeHRlcm5hbCBhdXRoOiBBdXRoZW50aWNhdGlvbiBvZiBob3N0IGNyeXB0b2dyYW0gZmFpbGVkLCBvciBWZXJpZmljYXRpb24gb2YgY2VydGlmaWNhdGUgZmFpbGVkXCJ9LFxuICAgICAgICB7c3cxOiAweDYzLCBzdzI6IDB4MTAsIHRpdGxlOiBcIk1vcmUgZGF0YSBhdmFpbGFibGVcIn0sXG4gICAgICAgIHtzdzE6IDB4NjQsIHN3MjogMHgwMCwgdGl0bGU6IFwiTm8gc3BlY2lmaWMgZGlhZ25vc2lzXCJ9LFxuICAgICAgICB7c3cxOiAweDY1LCBzdzI6IDB4ODEsIHRpdGxlOiBcIk1lbW9yeSBmYWlsdXJlXCJ9LFxuICAgICAgICB7c3cxOiAweDY3LCBzdzI6IDB4MDAsIHRpdGxlOiBcIldyb25nIGxlbmd0aCBpbiBMY1wifSxcbiAgICAgICAge3N3MTogMHg2OCwgc3cyOiAweDgxLCB0aXRsZTogXCJMb2dpY2FsIGNoYW5uZWwgbm90IHN1cHBvcnRlZCBvciBpcyBub3QgYWN0aXZlXCJ9LFxuICAgICAgICB7c3cxOiAweDY4LCBzdzI6IDB4ODIsIHRpdGxlOiBcIlNlY3VyZSBtZXNzYWdpbmcgbm90IHN1cHBvcnRlZFwifSxcbiAgICAgICAge3N3MTogMHg2OCwgc3cyOiAweDgzLCB0aXRsZTogXCJUaGUgbGFzdCBjb21tYW5kIG9mIHRoZSBjaGFpbiB3YXMgZXhwZWN0ZWRcIn0sXG4gICAgICAgIHtzdzE6IDB4NjksIHN3MjogMHg4MiwgdGl0bGU6IFwiU2VjdXJpdHkgc3RhdHVzIG5vdCBzYXRpc2ZpZWRcIn0sXG4gICAgICAgIHtzdzE6IDB4NjksIHN3MjogMHg4NSwgdGl0bGU6IFwiQ29uZGl0aW9ucyBvZiB1c2Ugbm90IHNhdGlzZmllZFwifSxcbiAgICAgICAge3N3MTogMHg2QSwgc3cyOiAweDgwLCB0aXRsZTogXCJJbmNvcnJlY3QgdmFsdWVzIGluIGNvbW1hbmQgZGF0YVwifSxcbiAgICAgICAge3N3MTogMHg2QSwgc3cyOiAweDgxLCB0aXRsZTogXCJGdW5jdGlvbiBub3Qgc3VwcG9ydGVkIGUuZy4gY2FyZCBMaWZlIEN5Y2xlIFN0YXRlIGlzIENBUkRfTE9DS0VEXCJ9LFxuICAgICAgICB7c3cxOiAweDZBLCBzdzI6IDB4ODIsIHRpdGxlOiBcIkFwcGxpY2F0aW9uL2ZpbGUgbm90IGZvdW5kXCJ9LFxuICAgICAgICB7c3cxOiAweDZBLCBzdzI6IDB4ODQsIHRpdGxlOiBcIk5vdCBlbm91Z2ggbWVtb3J5IHNwYWNlXCJ9LFxuICAgICAgICB7c3cxOiAweDZBLCBzdzI6IDB4ODYsIHRpdGxlOiBcIkluY29ycmVjdCBQMSBQMlwifSxcbiAgICAgICAge3N3MTogMHg2QSwgc3cyOiAweDg4LCB0aXRsZTogXCJSZWZlcmVuY2VkIGRhdGEgbm90IGZvdW5kXCJ9LFxuICAgICAgICB7c3cxOiAweDZELCBzdzI6IDB4MDAsIHRpdGxlOiBcIkluc3RydWN0aW9uIG5vdCBzdXBwb3J0ZWQgb3IgaW52YWxpZFwifSxcbiAgICAgICAge3N3MTogMHg2RSwgc3cyOiAweDAwLCB0aXRsZTogXCJJbnZhbGlkIGNsYXNzXCJ9LFxuICAgICAgICB7c3cxOiAweDZGLCBzdzI6IDB4MDAsIHRpdGxlOiBcIk5vIHNwZWNpZmljIGRpYWdub3NpcyBlcnJvciAodHlwaWNhbGx5IGxvdyBsZXZlbCBlcnJvciwgZS5nLiBydW50aW1lIGV4Y2VwdGlvbilcIn0sXG4gICAgICAgIHtzdzE6IDB4OTQsIHN3MjogMHg4NCwgdGl0bGU6IFwiQWxnb3JpdGhtIG5vdCBzdXBwb3J0ZWRcIn0sXG4gICAgICAgIHtzdzE6IDB4OTQsIHN3MjogMHg4NSwgdGl0bGU6IFwiSW52YWxpZCBrZXkgY2hlY2sgdmFsdWVcIn1cbiAgICBdXG59O1xuIl19
