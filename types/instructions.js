"use strict";

var m = require("mithril");

module.exports = {
    view : function(ctrl, options) {
        var details = options.details;
        
        return m("div",
            m("strong", options.name),
            details.text ? m("p", details.text) : null
        );
    }
};
