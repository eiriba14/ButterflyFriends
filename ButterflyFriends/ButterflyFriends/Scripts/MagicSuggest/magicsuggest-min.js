(function($) {
    "use strict";
    var MagicSuggest = function(element, options) {
        var ms = this;
        var defaults = {
            allowFreeEntries: true,
            allowDuplicates: false,
            ajaxConfig: {},
            autoSelect: true,
            selectFirst: false,
            queryParam: "query",
            beforeSend: function() {},
            cls: "",
            data: null,
            dataUrlParams: {},
            disabled: false,
            disabledField: null,
            displayField: "name",
            editable: true,
            expanded: false,
            expandOnFocus: false,
            groupBy: null,
            hideTrigger: false,
            highlight: true,
            id: null,
            infoMsgCls: "",
            inputCfg: {},
            invalidCls: "ms-inv",
            matchCase: false,
            maxDropHeight: 290,
            maxEntryLength: null,
            maxEntryRenderer: function(v) {
                return"Please reduce your entry by " + v + " character" + (v > 1 ? "s" : "");
            },
            maxSuggestions: null,
            maxSelection: 10,
            maxSelectionRenderer: function(v) {
                return"You cannot choose more than " + v + " item" + (v > 1 ? "s" : "");
            },
            method: "POST",
            minChars: 0,
            minCharsRenderer: function(v) { return"Please type " + v + " more character" + (v > 1 ? "s" : "") },
            mode: "local",
            name: null,
            noSuggestionText: "No suggestions",
            placeholder: "Type or click here",
            renderer: null,
            required: false,
            resultAsString: false,
            resultAsStringDelimiter: ",",
            resultsField: "results",
            selectionCls: "",
            selectionContainer: null,
            selectionPosition: "inner",
            selectionRenderer: null,
            selectionStacked: false,
            sortDir: "asc",
            sortOrder: null,
            strictSuggest: false,
            style: "",
            toggleOnClick: false,
            typeDelay: 400,
            useTabKey: false,
            useCommaKey: true,
            useZebraStyle: false,
            value: null,
            valueField: "id",
            vregex: null,
            vtype: null
        };
        var conf = $.extend({}, options);
        var cfg = $.extend(true, {}, defaults, conf);
        this.addToSelection = function(items, isSilent) {
            if (!cfg.maxSelection || _selection.length < cfg.maxSelection) {
                if (!$.isArray(items)) {
                    items = [items];
                }
                var valuechanged = false;
                $.each(items,
                    function(index, json) {
                        if (cfg.allowDuplicates || $.inArray(json[cfg.valueField], ms.getValue()) === -1) {
                            _selection.push(json);
                            valuechanged = true;
                        }
                    });
                if (valuechanged === true) {
                    self._renderSelection();
                    this.empty();
                    if (isSilent !== true) {
                        $(this).trigger("selectionchange", [this, this.getSelection()]);
                    }
                }
            }
            this.input.attr("placeholder",
                cfg.selectionPosition === "inner" && this.getValue().length > 0 ? "" : cfg.placeholder);
        };
        this.clear = function(isSilent) { this.removeFromSelection(_selection.slice(0), isSilent) };
        this.collapse = function() {
            if (cfg.expanded === true) {
                this.combobox.detach();
                cfg.expanded = false;
                $(this).trigger("collapse", [this]);
            }
        };
        this.disable = function() {
            this.container.addClass("ms-ctn-disabled");
            cfg.disabled = true;
            ms.input.attr("disabled", true);
        };
        this.empty = function() { this.input.val("") };
        this.enable = function() {
            this.container.removeClass("ms-ctn-disabled");
            cfg.disabled = false;
            ms.input.attr("disabled", false);
        };
        this.expand = function() {
            if (!cfg.expanded && (this.input.val().length >= cfg.minChars || this.combobox.children().length > 0)) {
                this.combobox.appendTo(this.container);
                self._processSuggestions();
                cfg.expanded = true;
                $(this).trigger("expand", [this]);
            }
        };
        this.isDisabled = function() { return cfg.disabled };
        this.isValid = function() {
            var valid = cfg.required === false || _selection.length > 0;
            if (cfg.vtype || cfg.vregex) {
                $.each(_selection,
                    function(index, item) { valid = valid && self._validateSingleItem(item[cfg.valueField]) });
            }
            return valid;
        };
        this.getDataUrlParams = function() { return cfg.dataUrlParams };
        this.getName = function() { return cfg.name };
        this.getSelection = function() { return _selection };
        this.getRawValue = function() { return ms.input.val() };
        this.getValue = function() { return $.map(_selection, function(o) { return o[cfg.valueField] }) };
        this.removeFromSelection = function(items, isSilent) {
            if (!$.isArray(items)) {
                items = [items];
            }
            var valuechanged = false;
            $.each(items,
                function(index, json) {
                    var i = $.inArray(json[cfg.valueField], ms.getValue());
                    if (i > -1) {
                        _selection.splice(i, 1);
                        valuechanged = true;
                    }
                });
            if (valuechanged === true) {
                self._renderSelection();
                if (isSilent !== true) {
                    $(this).trigger("selectionchange", [this, this.getSelection()]);
                }
                if (cfg.expandOnFocus) {
                    ms.expand();
                }
                if (cfg.expanded) {
                    self._processSuggestions();
                }
            }
            this.input.attr("placeholder",
                cfg.selectionPosition === "inner" && this.getValue().length > 0 ? "" : cfg.placeholder);
        };
        this.getData = function() { return _cbData };
        this.setData = function(data) {
            cfg.data = data;
            self._processSuggestions();
        };
        this.setName = function(name) {
            cfg.name = name;
            if (name) {
                cfg.name += name.indexOf("[]") > 0 ? "" : "[]";
            }
            if (ms._valueContainer) {
                $.each(ms._valueContainer.children(), function(i, el) { el.name = cfg.name });
            }
        };
        this.setSelection = function(items) {
            this.clear();
            this.addToSelection(items);
        };
        this.setValue = function(values) {
            var items = [];
            $.each(values,
                function(index, value) {
                    var found = false;
                    $.each(_cbData,
                        function(i, item) {
                            if (item[cfg.valueField] == value) {
                                items.push(item);
                                found = true;
                                return false;
                            }
                        });
                    if (!found) {
                        if (typeof value === "object") {
                            items.push(value);
                        } else {
                            var json = {};
                            json[cfg.valueField] = value;
                            json[cfg.displayField] = value;
                            items.push(json);
                        }
                    }
                });
            if (items.length > 0) {
                this.addToSelection(items);
            }
        };
        this.setDataUrlParams = function(params) { cfg.dataUrlParams = $.extend({}, params) };
        var _selection = [],
            _comboItemHeight = 0,
            _timer,
            _hasFocus = false,
            _groups = null,
            _cbData = [],
            _ctrlDown = false,
            KEYCODES = {
                BACKSPACE: 8,
                TAB: 9,
                ENTER: 13,
                CTRL: 17,
                ESC: 27,
                SPACE: 32,
                UPARROW: 38,
                DOWNARROW: 40,
                COMMA: 188
            };
        var self = {
            _displaySuggestions: function(data) {
                ms.combobox.show();
                ms.combobox.empty();
                var resHeight = 0, nbGroups = 0;
                if (_groups === null) {
                    self._renderComboItems(data);
                    resHeight = _comboItemHeight * data.length;
                } else {
                    for (var grpName in _groups) {
                        nbGroups += 1;
                        $("<div/>", { "class": "ms-res-group", html: grpName }).appendTo(ms.combobox);
                        self._renderComboItems(_groups[grpName].items, true);
                    }
                    var _groupItemHeight = ms.combobox.find(".ms-res-group").outerHeight();
                    if (_groupItemHeight !== null) {
                        var tmpResHeight = nbGroups * _groupItemHeight;
                        resHeight = _comboItemHeight * data.length + tmpResHeight;
                    } else {
                        resHeight = _comboItemHeight * (data.length + nbGroups);
                    }
                }
                if (resHeight < ms.combobox.height() || resHeight <= cfg.maxDropHeight) {
                    ms.combobox.height(resHeight);
                } else if (resHeight >= ms.combobox.height() && resHeight > cfg.maxDropHeight) {
                    ms.combobox.height(cfg.maxDropHeight);
                }
                if (data.length === 1 && cfg.autoSelect === true) {
                    ms.combobox.children().filter(":not(.ms-res-item-disabled):last").addClass("ms-res-item-active");
                }
                if (cfg.selectFirst === true) {
                    ms.combobox.children().filter(":not(.ms-res-item-disabled):first").addClass("ms-res-item-active");
                }
                if (data.length === 0 && ms.getRawValue() !== "") {
                    var noSuggestionText = cfg.noSuggestionText.replace(/\{\{.*\}\}/, ms.input.val());
                    self._updateHelper(noSuggestionText);
                    ms.collapse();
                }
                if (cfg.allowFreeEntries === false) {
                    if (data.length === 0) {
                        $(ms.input).addClass(cfg.invalidCls);
                        ms.combobox.hide();
                    } else {
                        $(ms.input).removeClass(cfg.invalidCls);
                    }
                }
            },
            _getEntriesFromStringArray: function(data) {
                var json = [];
                $.each(data,
                    function(index, s) {
                        var entry = {};
                        entry[cfg.displayField] = entry[cfg.valueField] = $.trim(s);
                        json.push(entry);
                    });
                return json;
            },
            _highlightSuggestion: function(html) {
                var q = ms.input.val();
                var specialCharacters = ["^", "$", "*", "+", "?", ".", "(", ")", ":", "!", "|", "{", "}", "[", "]"];
                $.each(specialCharacters, function(index, value) { q = q.replace(value, "\\" + value) });
                if (q.length === 0) {
                    return html;
                }
                var glob = cfg.matchCase === true ? "g" : "gi";
                return html.replace(new RegExp("(" + q + ")(?!([^<]+)?>)", glob), "<em>$1</em>");
            },
            _moveSelectedRow: function(dir) {
                if (!cfg.expanded) {
                    ms.expand();
                }
                var list, start, active, scrollPos;
                list = ms.combobox.find(".ms-res-item:not(.ms-res-item-disabled)");
                if (dir === "down") {
                    start = list.eq(0);
                } else {
                    start = list.filter(":last");
                }
                active = ms.combobox.find(".ms-res-item-active:not(.ms-res-item-disabled):first");
                if (active.length > 0) {
                    if (dir === "down") {
                        start = active.nextAll(".ms-res-item:not(.ms-res-item-disabled)").first();
                        if (start.length === 0) {
                            start = list.eq(0);
                        }
                        scrollPos = ms.combobox.scrollTop();
                        ms.combobox.scrollTop(0);
                        if (start[0].offsetTop + start.outerHeight() > ms.combobox.height()) {
                            ms.combobox.scrollTop(scrollPos + _comboItemHeight);
                        }
                    } else {
                        start = active.prevAll(".ms-res-item:not(.ms-res-item-disabled)").first();
                        if (start.length === 0) {
                            start = list.filter(":last");
                            ms.combobox.scrollTop(_comboItemHeight * list.length);
                        }
                        if (start[0].offsetTop < ms.combobox.scrollTop()) {
                            ms.combobox.scrollTop(ms.combobox.scrollTop() - _comboItemHeight);
                        }
                    }
                }
                list.removeClass("ms-res-item-active");
                start.addClass("ms-res-item-active");
            },
            _processSuggestions: function(source) {
                var json = null, data = source || cfg.data;
                if (data !== null) {
                    if (typeof data === "function") {
                        data = data.call(ms, ms.getRawValue());
                    }
                    if (typeof data === "string") {
                        $(ms).trigger("beforeload", [ms]);
                        var queryParams = {};
                        queryParams[cfg.queryParam] = ms.input.val();
                        var params = $.extend(queryParams, cfg.dataUrlParams);
                        $.ajax($.extend({
                                type: cfg.method,
                                url: data,
                                data: params,
                                beforeSend: cfg.beforeSend,
                                success: function(asyncData) {
                                    json = typeof asyncData === "string" ? JSON.parse(asyncData) : asyncData;
                                    self._processSuggestions(json);
                                    $(ms).trigger("load", [ms, json]);
                                    if (self._asyncValues) {
                                        ms.setValue(typeof self._asyncValues === "string"
                                            ? JSON.parse(self._asyncValues)
                                            : self._asyncValues);
                                        self._renderSelection();
                                        delete self._asyncValues;
                                    }
                                },
                                error: function() { throw"Could not reach server" }
                            },
                            cfg.ajaxConfig));
                        return;
                    } else {
                        if (data.length > 0 && typeof data[0] === "string") {
                            _cbData = self._getEntriesFromStringArray(data);
                        } else {
                            _cbData = data[cfg.resultsField] || data;
                        }
                    }
                    var sortedData = cfg.mode === "remote" ? _cbData : self._sortAndTrim(_cbData);
                    self._displaySuggestions(self._group(sortedData));
                }
            },
            _render: function(el) {
                ms.setName(cfg.name);
                ms.container = $("<div/>",
                {
                    "class": "ms-ctn form-control " +
                        (cfg.resultAsString ? "ms-as-string " : "") +
                        cfg.cls +
                        ($(el).hasClass("input-lg") ? " input-lg" : "") +
                        ($(el).hasClass("input-sm") ? " input-sm" : "") +
                        (cfg.disabled === true ? " ms-ctn-disabled" : "") +
                        (cfg.editable === true ? "" : " ms-ctn-readonly") +
                        (cfg.hideTrigger === false ? "" : " ms-no-trigger"),
                    style: cfg.style,
                    id: cfg.id
                });
                ms.container.focus($.proxy(handlers._onFocus, this));
                ms.container.blur($.proxy(handlers._onBlur, this));
                ms.container.keydown($.proxy(handlers._onKeyDown, this));
                ms.container.keyup($.proxy(handlers._onKeyUp, this));
                ms.input = $("<input/>",
                    $.extend({
                            type: "text",
                            "class": cfg.editable === true ? "" : " ms-input-readonly",
                            readonly: !cfg.editable,
                            placeholder: cfg.placeholder,
                            disabled: cfg.disabled
                        },
                        cfg.inputCfg));
                ms.input.focus($.proxy(handlers._onInputFocus, this));
                ms.input.click($.proxy(handlers._onInputClick, this));
                ms.combobox = $("<div/>", { "class": "ms-res-ctn dropdown-menu" }).height(cfg.maxDropHeight);
                ms.combobox.on("click", "div.ms-res-item", $.proxy(handlers._onComboItemSelected, this));
                ms.combobox.on("mouseover", "div.ms-res-item", $.proxy(handlers._onComboItemMouseOver, this));
                if (cfg.selectionContainer) {
                    ms.selectionContainer = cfg.selectionContainer;
                    $(ms.selectionContainer).addClass("ms-sel-ctn");
                } else {
                    ms.selectionContainer = $("<div/>", { "class": "ms-sel-ctn" });
                }
                ms.selectionContainer.click($.proxy(handlers._onFocus, this));
                if (cfg.selectionPosition === "inner" && !cfg.selectionContainer) {
                    ms.selectionContainer.append(ms.input);
                } else {
                    ms.container.append(ms.input);
                }
                ms.helper = $("<span/>", { "class": "ms-helper " + cfg.infoMsgCls });
                self._updateHelper();
                ms.container.append(ms.helper);
                $(el).replaceWith(ms.container);
                if (!cfg.selectionContainer) {
                    switch (cfg.selectionPosition) {
                    case"bottom":
                        ms.selectionContainer.insertAfter(ms.container);
                        if (cfg.selectionStacked === true) {
                            ms.selectionContainer.width(ms.container.width());
                            ms.selectionContainer.addClass("ms-stacked");
                        }
                        break;
                    case"right":
                        ms.selectionContainer.insertAfter(ms.container);
                        ms.container.css("float", "left");
                        break;
                    default:
                        ms.container.append(ms.selectionContainer);
                        break;
                    }
                }
                if (cfg.hideTrigger === false) {
                    ms.trigger = $("<div/>", { "class": "ms-trigger", html: '<div class="ms-trigger-ico"></div>' });
                    ms.trigger.click($.proxy(handlers._onTriggerClick, this));
                    ms.container.append(ms.trigger);
                }
                $(window).resize($.proxy(handlers._onWindowResized, this));
                if (cfg.value !== null || cfg.data !== null) {
                    if (typeof cfg.data === "string") {
                        self._asyncValues = cfg.value;
                        self._processSuggestions();
                    } else {
                        self._processSuggestions();
                        if (cfg.value !== null) {
                            ms.setValue(cfg.value);
                            self._renderSelection();
                        }
                    }
                }
                $("body")
                    .click(function(e) {
                        if (ms.container.hasClass("ms-ctn-focus") &&
                            ms.container.has(e.target).length === 0 &&
                            e.target.className.indexOf("ms-res-item") < 0 &&
                            e.target.className.indexOf("ms-close-btn") < 0 &&
                            ms.container[0] !== e.target) {
                            handlers._onBlur();
                        }
                    });
                if (cfg.expanded === true) {
                    cfg.expanded = false;
                    ms.expand();
                }
            },
            _renderComboItems: function(items, isGrouped) {
                var ref = this, html = "";
                $.each(items,
                    function(index, value) {
                        var displayed = cfg.renderer !== null ? cfg.renderer.call(ref, value) : value[cfg.displayField];
                        var disabled = cfg.disabledField !== null && value[cfg.disabledField] === true;
                        var resultItemEl = $("<div/>",
                        {
                            "class": "ms-res-item " +
                                (isGrouped ? "ms-res-item-grouped " : "") +
                                (disabled ? "ms-res-item-disabled " : "") +
                                (index % 2 === 1 && cfg.useZebraStyle === true ? "ms-res-odd" : ""),
                            html: cfg.highlight === true ? self._highlightSuggestion(displayed) : displayed,
                            "data-json": JSON.stringify(value)
                        });
                        html += $("<div/>").append(resultItemEl).html();
                    });
                ms.combobox.append(html);
                _comboItemHeight = ms.combobox.find(".ms-res-item:first").outerHeight();
            },
            _renderSelection: function() {
                var ref = this, w = 0, inputOffset = 0, items = [], asText = cfg.resultAsString === true && !_hasFocus;
                ms.selectionContainer.find(".ms-sel-item").remove();
                if (ms._valueContainer !== undefined) {
                    ms._valueContainer.remove();
                }
                $.each(_selection,
                    function(index, value) {
                        var selectedItemEl,
                            delItemEl,
                            selectedItemHtml = cfg.selectionRenderer !== null
                                ? cfg.selectionRenderer.call(ref, value)
                                : value[cfg.displayField];
                        var validCls = self._validateSingleItem(value[cfg.displayField]) ? "" : " ms-sel-invalid";
                        if (asText === true) {
                            selectedItemEl = $("<div/>",
                                {
                                    "class": "ms-sel-item ms-sel-text " + cfg.selectionCls + validCls,
                                    html: selectedItemHtml +
                                        (index === _selection.length - 1 ? "" : cfg.resultAsStringDelimiter)
                                })
                                .data("json", value);
                        } else {
                            selectedItemEl = $("<div/>",
                                    { "class": "ms-sel-item " + cfg.selectionCls + validCls, html: selectedItemHtml })
                                .data("json", value);
                            if (cfg.disabled === false) {
                                delItemEl = $("<span/>", { "class": "ms-close-btn" })
                                    .data("json", value)
                                    .appendTo(selectedItemEl);
                                delItemEl.click($.proxy(handlers._onTagTriggerClick, ref));
                            }
                        }
                        items.push(selectedItemEl);
                    });
                ms.selectionContainer.prepend(items);
                ms._valueContainer = $("<div/>", { style: "display: none;" });
                $.each(ms.getValue(),
                    function(i, val) {
                        var el = $("<input/>", { type: "hidden", name: cfg.name, value: val });
                        el.appendTo(ms._valueContainer);
                    });
                ms._valueContainer.appendTo(ms.selectionContainer);
                if (cfg.selectionPosition === "inner" && !cfg.selectionContainer) {
                    ms.input.width(0);
                    inputOffset = ms.input.offset().left - ms.selectionContainer.offset().left;
                    w = ms.container.width() - inputOffset - 42;
                    ms.input.width(w);
                }
                if (_selection.length === cfg.maxSelection) {
                    self._updateHelper(cfg.maxSelectionRenderer.call(this, _selection.length));
                } else {
                    ms.helper.hide();
                }
            },
            _selectItem: function(item) {
                if (cfg.maxSelection === 1) {
                    _selection = [];
                }
                ms.addToSelection(item.data("json"));
                item.removeClass("ms-res-item-active");
                if (cfg.expandOnFocus === false || _selection.length === cfg.maxSelection) {
                    ms.collapse();
                }
                if (!_hasFocus) {
                    ms.input.focus();
                } else if (_hasFocus && (cfg.expandOnFocus || _ctrlDown)) {
                    self._processSuggestions();
                    if (_ctrlDown) {
                        ms.expand();
                    }
                }
            },
            _sortAndTrim: function(data) {
                var q = ms.getRawValue(), filtered = [], newSuggestions = [], selectedValues = ms.getValue();
                if (q.length > 0) {
                    $.each(data,
                        function(index, obj) {
                            var name = obj[cfg.displayField];
                            if (cfg.matchCase === true && name.indexOf(q) > -1 ||
                                cfg.matchCase === false && name.toLowerCase().indexOf(q.toLowerCase()) > -1) {
                                if (cfg.strictSuggest === false || name.toLowerCase().indexOf(q.toLowerCase()) === 0) {
                                    filtered.push(obj);
                                }
                            }
                        });
                } else {
                    filtered = data;
                }
                $.each(filtered,
                    function(index, obj) {
                        if (cfg.allowDuplicates || $.inArray(obj[cfg.valueField], selectedValues) === -1) {
                            newSuggestions.push(obj);
                        }
                    });
                if (cfg.sortOrder !== null) {
                    newSuggestions.sort(function(a, b) {
                        if (a[cfg.sortOrder] < b[cfg.sortOrder]) {
                            return cfg.sortDir === "asc" ? -1 : 1;
                        }
                        if (a[cfg.sortOrder] > b[cfg.sortOrder]) {
                            return cfg.sortDir === "asc" ? 1 : -1;
                        }
                        return 0;
                    });
                }
                if (cfg.maxSuggestions && cfg.maxSuggestions > 0) {
                    newSuggestions = newSuggestions.slice(0, cfg.maxSuggestions);
                }
                return newSuggestions;
            },
            _group: function(data) {
                if (cfg.groupBy !== null) {
                    _groups = {};
                    $.each(data,
                        function(index, value) {
                            var props = cfg.groupBy.indexOf(".") > -1 ? cfg.groupBy.split(".") : cfg.groupBy;
                            var prop = value[cfg.groupBy];
                            if (typeof props != "string") {
                                prop = value;
                                while (props.length > 0) {
                                    prop = prop[props.shift()];
                                }
                            }
                            if (_groups[prop] === undefined) {
                                _groups[prop] = { title: prop, items: [value] };
                            } else {
                                _groups[prop].items.push(value);
                            }
                        });
                }
                return data;
            },
            _updateHelper: function(html) {
                ms.helper.html(html);
                if (!ms.helper.is(":visible")) {
                    ms.helper.fadeIn();
                }
            },
            _validateSingleItem: function(value) {
                if (cfg.vregex !== null && cfg.vregex instanceof RegExp) {
                    return cfg.vregex.test(value);
                } else if (cfg.vtype !== null) {
                    switch (cfg.vtype) {
                    case"alpha":
                        return/^[a-zA-Z_]+$/.test(value);
                    case"alphanum":
                        return/^[a-zA-Z0-9_]+$/.test(value);
                    case"email":
                        return/^(\w+)([\-+.][\w]+)*@(\w[\-\w]*\.){1,5}([A-Za-z]){2,6}$/.test(value);
                    case"url":
                        return/(((^https?)|(^ftp)):\/\/([\-\w]+\.)+\w{2,3}(\/[%\-\w]+(\.\w{2,})?)*(([\w\-\.\?\\\/+@&#;`~=%!]*)(\.\w{2,})?)*\/?)/i.test(value);
                    case"ipaddress":
                        return/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(value);
                    }
                }
                return true;
            }
        };
        var handlers = {
            _onBlur: function() {
                ms.container.removeClass("ms-ctn-focus");
                ms.collapse();
                _hasFocus = false;
                if (ms.getRawValue() !== "" && cfg.allowFreeEntries === true) {
                    var obj = {};
                    obj[cfg.displayField] = obj[cfg.valueField] = ms.getRawValue().trim();
                    ms.addToSelection(obj);
                }
                self._renderSelection();
                if (ms.isValid() === false) {
                    ms.container.addClass(cfg.invalidCls);
                } else if (ms.input.val() !== "" && cfg.allowFreeEntries === false) {
                    ms.empty();
                    self._updateHelper("");
                }
                $(ms).trigger("blur", [ms]);
            },
            _onComboItemMouseOver: function(e) {
                var target = $(e.currentTarget);
                if (!target.hasClass("ms-res-item-disabled")) {
                    ms.combobox.children().removeClass("ms-res-item-active");
                    target.addClass("ms-res-item-active");
                }
            },
            _onComboItemSelected: function(e) {
                var target = $(e.currentTarget);
                if (!target.hasClass("ms-res-item-disabled")) {
                    self._selectItem($(e.currentTarget));
                }
            },
            _onFocus: function() { ms.input.focus() },
            _onInputClick: function() {
                if (ms.isDisabled() === false && _hasFocus) {
                    if (cfg.toggleOnClick === true) {
                        if (cfg.expanded) {
                            ms.collapse();
                        } else {
                            ms.expand();
                        }
                    }
                }
            },
            _onInputFocus: function() {
                if (ms.isDisabled() === false && !_hasFocus) {
                    _hasFocus = true;
                    ms.container.addClass("ms-ctn-focus");
                    ms.container.removeClass(cfg.invalidCls);
                    var curLength = ms.getRawValue().length;
                    if (cfg.expandOnFocus === true) {
                        ms.expand();
                    }
                    if (_selection.length === cfg.maxSelection) {
                        self._updateHelper(cfg.maxSelectionRenderer.call(this, _selection.length));
                    } else if (curLength < cfg.minChars) {
                        self._updateHelper(cfg.minCharsRenderer.call(this, cfg.minChars - curLength));
                    }
                    self._renderSelection();
                    $(ms).trigger("focus", [ms]);
                }
            },
            _onKeyDown: function(e) {
                var active = ms.combobox.find(".ms-res-item-active:not(.ms-res-item-disabled):first"),
                    freeInput = ms.input.val();
                $(ms).trigger("keydown", [ms, e]);
                if (e.keyCode === KEYCODES.TAB &&
                (cfg.useTabKey === false ||
                    cfg.useTabKey === true && active.length === 0 && ms.input.val().length === 0)) {
                    handlers._onBlur();
                    return;
                }
                switch (e.keyCode) {
                case KEYCODES.BACKSPACE:
                    if (freeInput.length === 0 && ms.getSelection().length > 0 && cfg.selectionPosition === "inner") {
                        _selection.pop();
                        self._renderSelection();
                        $(ms).trigger("selectionchange", [ms, ms.getSelection()]);
                        ms.input.attr("placeholder",
                            cfg.selectionPosition === "inner" && ms.getValue().length > 0 ? "" : cfg.placeholder);
                        ms.input.focus();
                        e.preventDefault();
                    }
                    break;
                case KEYCODES.TAB:
                case KEYCODES.ESC:
                    e.preventDefault();
                    break;
                case KEYCODES.ENTER:
                    if (freeInput !== "" || cfg.expanded) {
                        e.preventDefault();
                    }
                    break;
                case KEYCODES.COMMA:
                    if (cfg.useCommaKey === true) {
                        e.preventDefault();
                    }
                    break;
                case KEYCODES.CTRL:
                    _ctrlDown = true;
                    break;
                case KEYCODES.DOWNARROW:
                    e.preventDefault();
                    self._moveSelectedRow("down");
                    break;
                case KEYCODES.UPARROW:
                    e.preventDefault();
                    self._moveSelectedRow("up");
                    break;
                default:
                    if (_selection.length === cfg.maxSelection) {
                        e.preventDefault();
                    }
                    break;
                }
            },
            _onKeyUp: function(e) {
                var freeInput = ms.getRawValue(),
                    inputValid = $.trim(ms.input.val()).length > 0 &&
                        (!cfg.maxEntryLength || $.trim(ms.input.val()).length <= cfg.maxEntryLength),
                    selected,
                    obj = {};
                $(ms).trigger("keyup", [ms, e]);
                clearTimeout(_timer);
                if (e.keyCode === KEYCODES.ESC && cfg.expanded) {
                    ms.combobox.hide();
                }
                if (e.keyCode === KEYCODES.TAB && cfg.useTabKey === false ||
                    e.keyCode > KEYCODES.ENTER && e.keyCode < KEYCODES.SPACE) {
                    if (e.keyCode === KEYCODES.CTRL) {
                        _ctrlDown = false;
                    }
                    return;
                }
                switch (e.keyCode) {
                case KEYCODES.UPARROW:
                case KEYCODES.DOWNARROW:
                    e.preventDefault();
                    break;
                case KEYCODES.ENTER:
                case KEYCODES.TAB:
                case KEYCODES.COMMA:
                    if (e.keyCode !== KEYCODES.COMMA || cfg.useCommaKey === true) {
                        e.preventDefault();
                        if (cfg.expanded === true) {
                            selected = ms.combobox.find(".ms-res-item-active:not(.ms-res-item-disabled):first");
                            if (selected.length > 0) {
                                self._selectItem(selected);
                                return;
                            }
                        }
                        if (inputValid === true && cfg.allowFreeEntries === true) {
                            obj[cfg.displayField] = obj[cfg.valueField] = freeInput.trim();
                            ms.addToSelection(obj);
                            ms.collapse();
                            ms.input.focus();
                        }
                        break;
                    }
                default:
                    if (_selection.length === cfg.maxSelection) {
                        self._updateHelper(cfg.maxSelectionRenderer.call(this, _selection.length));
                    } else {
                        if (freeInput.length < cfg.minChars) {
                            self._updateHelper(cfg.minCharsRenderer.call(this, cfg.minChars - freeInput.length));
                            if (cfg.expanded === true) {
                                ms.collapse();
                            }
                        } else if (cfg.maxEntryLength && freeInput.length > cfg.maxEntryLength) {
                            self._updateHelper(cfg.maxEntryRenderer.call(this, freeInput.length - cfg.maxEntryLength));
                            if (cfg.expanded === true) {
                                ms.collapse();
                            }
                        } else {
                            ms.helper.hide();
                            if (cfg.minChars <= freeInput.length) {
                                _timer = setTimeout(function() {
                                        if (cfg.expanded === true) {
                                            self._processSuggestions();
                                        } else {
                                            ms.expand();
                                        }
                                    },
                                    cfg.typeDelay);
                            }
                        }
                    }
                    break;
                }
            },
            _onTagTriggerClick: function(e) { ms.removeFromSelection($(e.currentTarget).data("json")) },
            _onTriggerClick: function() {
                if (ms
                    .isDisabled() ===
                    false &&
                    !(cfg.expandOnFocus === true && _selection.length === cfg.maxSelection)) {
                    $(ms).trigger("triggerclick", [ms]);
                    if (cfg.expanded === true) {
                        ms.collapse();
                    } else {
                        var curLength = ms.getRawValue().length;
                        if (curLength >= cfg.minChars) {
                            ms.input.focus();
                            ms.expand();
                        } else {
                            self._updateHelper(cfg.minCharsRenderer.call(this, cfg.minChars - curLength));
                        }
                    }
                }
            },
            _onWindowResized: function() { self._renderSelection() }
        };
        if (element !== null) {
            self._render(element);
        }
    };
    $.fn.magicSuggest = function(options) {
        var obj = $(this);
        if (obj.length === 1 && obj.data("magicSuggest")) {
            return obj.data("magicSuggest");
        }
        obj.each(function(i) {
            var cntr = $(this);
            if (cntr.data("magicSuggest")) {
                return;
            }
            if (this.nodeName.toLowerCase() === "select") {
                options.data = [];
                options.value = [];
                $.each(this.children,
                    function(index, child) {
                        if (child.nodeName && child.nodeName.toLowerCase() === "option") {
                            options.data.push({ id: child.value, name: child.text });
                            if ($(child).attr("selected")) {
                                options.value.push(child.value);
                            }
                        }
                    });
            }
            var def = {};
            $.each(this.attributes,
                function(i, att) {
                    def[att.name] = att.name === "value" && att.value !== "" ? JSON.parse(att.value) : att.value;
                });
            var field = new MagicSuggest(this, $.extend([], $.fn.magicSuggest.defaults, options, def));
            cntr.data("magicSuggest", field);
            field.container.data("magicSuggest", field);
        });
        if (obj.length === 1) {
            return obj.data("magicSuggest");
        }
        return obj;
    };
    $.fn.magicSuggest.defaults = {};
})(jQuery);