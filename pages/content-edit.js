"use strict";

var m = require("mithril"),

    children = require("../types/children"),
    db       = require("../lib/firebase"),
    update   = require("../lib/update"),
    publish  = require("./content/publish-status");

module.exports = {
    controller : function() {
        var ctrl = this,
            
            entry  = db.child("content/" + m.route.param("id")),
            schema = db.child("schemas/" + m.route.param("schema"));
        
        ctrl.ref    = entry;
        ctrl.entry  = null;
        ctrl.schema = null;
        ctrl.form   = null;
        
        entry.on("value", function(snap) {
            if(!snap.exists()) {
                return m.route("/content");
            }

            ctrl.entry = snap.val();

            if(!ctrl.entry.data) {
                ctrl.entry.data = {};
            }
            
            m.redraw();
        });
        
        schema.on("value", function(snap) {
            ctrl.schema = snap.val();

            m.redraw();
        });

        // Ensure the updated timestamp is always accurate-ish
        entry.on("child_changed", function(snap) {
            if(snap.key() === "updated") {
                return;
            }

            entry.child("updated").set(db.TIMESTAMP);
        });
    },

    view : function(ctrl) {
        var publishing;

        if(!ctrl.entry || !ctrl.schema) {
            return m("h1", "LOADING...");
        }

        publishing = m.component(publish, {
            ref     : ctrl.ref,
            data    : ctrl.entry,
            enabled : ctrl.form && ctrl.form.checkValidity()
        });

        return [
            m("h1", "Content - Editing \"" + (ctrl.entry._name || "") + "\""),
            
            m("div",
                m("label",
                    "Type: ",
                    m("a", { href : "/schemas/" + ctrl.entry._schema, config : m.route }, ctrl.schema.name)
                )
            ),
            publishing,
            m("hr"),
            m("div",
                m("label",
                    "Name: ",
                    m("input", {
                        value   : ctrl.entry._name || "",
                        oninput : m.withAttr("value", update.bind(null, ctrl.ref, "_name")),
                        config  : function(el, init) {
                            if(init) {
                                return;
                            }

                            el.select();
                        }
                    })
                )
            ),
            m("br"),
            m("form", {
                    config : function(el, init) {
                        if(init) {
                            return;
                        }

                        ctrl.form = el;

                        // force a redraw so publishing component can get
                        // new args w/ actual validity
                        m.redraw();
                    }
                },
                m.component(children, {
                    details : ctrl.schema.fields,
                    ref     : ctrl.ref,
                    data    : ctrl.entry,
                    root    : ctrl.ref
                })
            ),
            m("hr"),
            publishing
        ];
    }
};
