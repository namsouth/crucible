"use strict";

var m        = require("mithril"),
    paginate = require("paginationator"),
    moment   = require("moment"),
    fuzzy    = require("fuzzysearch"),
    debounce = require("lodash.debounce"),
    get      = require("lodash.get"),
    slug     = require("sluggo"),

    db = require("../../lib/firebase"),

    css = require("./nav.css"),

    size = 30;

module.exports = {
    controller : function(options) {
        var ctrl = this;

        ctrl.schema = options.schema;

        ctrl.page = 0;

        ctrl.entries = null;
        ctrl.content = null;
        ctrl.results = null;
        ctrl.hide    = false;

        // Go get initial data
        db.child("content/" + ctrl.schema.key).orderByChild("published").on("value", function(snap) {
            var entries = [];

            snap.forEach(function(record) {
                var data = record.val();

                data.key       = record.key();
                data.created   = moment.utc(data.created);
                data.updated   = moment.utc(data.updated);
                data.published = data.published ? moment.utc(data.published) : null;
                data.excerpt   = get(data, "fields.tabs.en.excerpt", null) || get(data, "fields.tabs.en.title", null);
                data.search    = slug(data.name, { separator : "" });

                entries.push(data);
            });

            ctrl.entries = entries;
            ctrl.content = entries.length && paginate(entries, { limit : size });

            m.redraw();
        });

        // Event handlers
        ctrl.hide = function() {
            ctrl.hidden = !ctrl.hidden;
        };

        ctrl.change = function(page, e) {
            e.preventDefault();

            ctrl.page = page;
        };

        // m.redraw calls are necessary due to debouncing, this function
        // may not be executing during a planned redraw cycle
        ctrl.filter = debounce(function(input) {
            if(input.length < 2) {
                ctrl.results = false;

                return m.redraw();
            }

            input = slug(input);

            ctrl.results = ctrl.entries.filter(function(content) {
                return fuzzy(input, content.search);
            }).slice(0, size);

            m.redraw();
        }, 100);
        
        ctrl.remove = function(data) {
            var ref = db.child("content").child(ctrl.schema.key).child(data.key);

            if(window.confirm("Remove " + data.name + "?")) {
                ref.once("value", function(snap) {
                    var data = snap.exportVal(),
                        rev  = data.version || 1,
                        dest = db.child("versions").child(snap.key()).child(rev);

                    dest.set(data);

                    remove(ref, function(error) {
                        if(error) {
                            console.error(error);
                        } else {
                            ctrl.fetch();
                        }
                    });
                });
            }
        };
    },

    view : function(ctrl) {
        var pages = [],
            current;

        if(ctrl.results) {
            current = {
                items : ctrl.results
            };
        } else {
            current = ctrl.content ? ctrl.content.pages[ctrl.page] : { items : [] };
        }

        if(ctrl.content && !ctrl.results) {
            // Add leading or trailing "..." to indicate that we aren't
            // showing all possible pages
            if(ctrl.content.pages.length > 15) {
                if(current.idx > 5) {
                    pages.push("...");
                }

                pages = pages.concat(ctrl.content.pages.slice(
                    Math.max(current.idx - 5, 0),
                    Math.min(current.idx + 5, ctrl.content.pages.length)
                ));

                if(current.idx < (ctrl.content.pages.length - 5)) {
                    pages.push("...");
                }
            } else {
                pages = ctrl.content.pages;
            }
        }

        return m(".nav", {
                class : ctrl.hidden ? css.hidden : css.nav
            },
            m(".head", { class : css.filter },
                !ctrl.hidden ? m("input", {
                    class       : css.text,
                    placeholder : "Search...",
                    oninput     : m.withAttr("value", ctrl.filter)
                }) : null,
                m("div", {
                        class   : ctrl.hidden ? css.show : css.hide,
                        onclick : ctrl.hide
                    },
                    m("span", ctrl.hidden ? "show" : "hide")
                )
            ),
            m(".body", { class : css.body },
                ctrl.hidden ?
                    null :
                    m("ul", { class : css.list },
                        current.items.map(function(data) {
                            return m("li", { class : data.published ? css.published : css.item },
                                m("a", {
                                    class  : css.anchor,
                                    href   : "/content/" + ctrl.schema.key + "/" + data.key,
                                    config : m.route
                                },
                                    m("h3", { class : css.heading }, data.name),
                                    m("p", { class : css.date },
                                        data.published ?
                                            "published: " + data.published.format("L") :
                                            "updated: " + data.updated.format("L")
                                    ),
                                    m("p", { class : css.excerpt }, data.excerpt)
                                ),
                                m("div", { class : css.actions },
                                    ctrl.schema.preview ? 
                                        m("a", {
                                                class  : css.preview,
                                                title  : "Preview",
                                                href   : ctrl.schema.preview + data.key,
                                                target : "_blank"
                                            },
                                            m("svg", { class : css.previewIcon },
                                                m("use", { href : "/src/icons.svg#icon-preview" })
                                            )
                                        ) :
                                        null,
                                    m("button", {
                                            class : css.remove,
                                            title : "Remove",

                                            onclick : ctrl.remove.bind(ctrl, data)
                                        },
                                        m("svg", { class : css.removeIcon },
                                            m("use", { href : "/src/icons.svg#icon-remove" })
                                        )
                                    )
                                )
                            );
                        })
                    )
            )
        );
    }
};