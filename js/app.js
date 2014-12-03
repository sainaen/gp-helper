var inses = {
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
};

var sws = [
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
];

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
