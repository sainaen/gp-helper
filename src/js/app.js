const gpHelper = require("./lib/gp-helper");

function render(inStr) {
    inStr = inStr.trim();
    if (!inStr) {
        throw "Empty input!";
    }
    if (gpHelper.isTokenizedAPDU(inStr)) {
        return "APDU (parts): " + gpHelper.formatAPDU(gpHelper.formTokenizedAPDU(inStr)) + "\n";
    }
    if (!gpHelper.isByteString(inStr)) {
        throw "Not a ByteString!";
    }
    var bytes = gpHelper.splitIntoBytes(inStr);
    if (gpHelper.isGpAPDU(bytes)) {
        return "APDU: " + gpHelper.formatAPDU(gpHelper.formAPDU(bytes)) + "\n";
    }
    if (gpHelper.isSelectAPDU(bytes)) {
        return "APDU: " + gpHelper.formatSelectAPDU(bytes) + "\n";
    }
    if (gpHelper.isSW(bytes)) {
        return "Status Word: " + gpHelper.formatSW(bytes) + "\n";
    }
    if (gpHelper.isINS(bytes)) {
        return "GP Command: " + gpHelper.inses[bytes[0]] + "\n";
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
        $more.replaceWith(bytes.map(gpHelper.formatByte).join(", "));
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
