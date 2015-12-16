///<reference path="typings/es6-promise/es6-promise.d.ts"/>
var dbprotoNs;
(function (dbprotoNs) {
    (function (Cardinality) {
        Cardinality[Cardinality["ONE"] = 0] = "ONE";
        Cardinality[Cardinality["MANY"] = 1] = "MANY";
    })(dbprotoNs.Cardinality || (dbprotoNs.Cardinality = {}));
    var Cardinality = dbprotoNs.Cardinality;
    //partial
    function browserCheck() {
        var UA = navigator.userAgent;
        var out = {};
        //mobile safari
        var iphone1 = UA.match(/(iPhone|iPad)/g);
        var iphone2 = UA.match(/Version\/[0-9]+/g);
        if (iphone1 && iphone2) {
            out.ios = Number(String(iphone2).split("/")[1]);
        }
        //browser safari
        var mac1 = UA.match(/(Macintosh)/g);
        var mac2 = UA.match(/Version\/[0-9]+/g);
        if (mac1 && mac2) {
            out.safari = Number(String(mac2).split("/")[1]);
        }
        return out;
    }
    /**
     * IndexedDB wrappers
     */
    var dbproto = (function () {
        /**
         * @param promise - Passing in a promise factory allows us to override
         * the default promise with angular's Q, which in turn bundles some 2-way data
         * binding thing along.
         */
        function dbproto(DBNAME, VERSION, promise) {
            this.DBNAME = DBNAME;
            this.VERSION = VERSION;
            this.$q = promise || Promise;
            var check = browserCheck();
            if ((check.ios || check.safari) && typeof shimIndexedDB !== "undefined")
                dbproto.useShim = true;
        }
        /**
         * Override to set the upgrade hook.
         */
        dbproto.prototype.upgradeHook = function (e) {
        };
        dbproto.prototype.query = function (objstore, queryOptions) {
            var _this = this;
            queryOptions = queryOptions || {};
            return this.load().then(function () {
                return new _this.$q(function (ok, fail) {
                    var ret = [];
                    var transaction = _this.db.transaction(objstore, 'readonly');
                    var store = transaction.objectStore(objstore);
                    var index = (queryOptions.index) ? store.index(queryOptions.index) : store;
                    var cursor = index.openCursor(queryOptions.keyRange || null);
                    cursor.onsuccess = function (e) {
                        if (e.target.result) {
                            if (queryOptions.filters) {
                                if (_this._applyFilter(queryOptions.filters, e.target.result.value)) {
                                    ret.push(e.target.result.value);
                                }
                            }
                            else if (queryOptions.filterFunc) {
                                if (queryOptions.filterFunc(e.target.result.value)) {
                                    ret.push(e.target.result.value);
                                }
                            }
                            else {
                                ret.push(e.target.result.value);
                            }
                            e.target.result.continue();
                        }
                    };
                    cursor.onerror = function () {
                        fail(Error());
                    };
                    transaction.oncomplete = function () {
                        ok(ret);
                    };
                });
            });
        };
        dbproto.prototype._applyFilter = function (filterArr, object) {
            var targetDesc = filterArr[0];
            var operator = filterArr[1];
            var compareTo = filterArr[2];
            var target = object[targetDesc];
            if (operator == "=") {
                if (target == compareTo)
                    return true;
            }
        };
        /**
         * Replaces fields in srcObject with queried data.
         * See JoinSpec.
         */
        dbproto.prototype.augmentJoin = function (srcObject, joinBy) {
            var _this = this;
            var joinByArr = (joinBy instanceof Array) ? joinBy : [joinBy];
            var alljoins = joinByArr.map(function (j) {
                if (!j.sourceField)
                    j.sourceField = j.sourceContainer;
                var deststore = (typeof j.destStore == "string") ? j.destStore : j.destStore(srcObject);
                var f;
                if (j.destIndex)
                    f = _this.getByIndex(deststore, j.destIndex, srcObject[j.sourceField]);
                else
                    f = _this.getObject(deststore, srcObject[j.sourceField]).then(function (r) {
                        return [r];
                    });
                return f.then(function (r) {
                    if (!r)
                        throw new Error('getAndJoin: item to join not found.');
                    srcObject[j.sourceContainer || j.sourceField] = (j.cardinality == Cardinality.ONE) ? r[0] : r;
                });
            });
            return this.$q.all(alljoins).then(function () {
                return srcObject;
            });
        };
        /**
         * Queries based on primary key
         */
        dbproto.prototype.getObject = function (objstore, id) {
            var _this = this;
            var that = this;
            return this.load().then(function () {
                return new _this.$q(function (ok, fail) {
                    var transaction = that.db.transaction(objstore, 'readonly');
                    var store = transaction.objectStore(objstore);
                    try {
                        var res = store.get(id);
                    }
                    catch (err) {
                        fail(Error("getObject objstore.get failed on id: " + id + " objstore: " + objstore));
                        throw err;
                    }
                    transaction.oncomplete = function () {
                        ok(res.result);
                    };
                    transaction.onerror = function () {
                        fail(Error());
                    };
                });
            });
        };
        dbproto.prototype.deleteObject = function (store_name, key) {
            var _this = this;
            var that = this;
            return this.load().then(function () {
                return new _this.$q(function (resolve, reject) {
                    var transaction = that.db.transaction(store_name, 'readwrite');
                    var store = transaction.objectStore(store_name);
                    var res = store.delete(key);
                    transaction.oncomplete = function () {
                        resolve(res.result);
                    };
                    transaction.onerror = function () {
                        reject(Error());
                    };
                });
            });
        };
        dbproto.prototype.getByIndex = function (store_name, indexName, value) {
            if (typeof value == "string" || typeof value == "number")
                value = IDBKeyRange.only(value);
            return this.query(store_name, { index: indexName, keyRange: value });
        };
        dbproto.prototype.clear = function (objstore) {
            var _this = this;
            return this.load().then(function () {
                return new _this.$q(function (fulfill) {
                    var transaction = _this.db.transaction(objstore, "readwrite");
                    transaction.objectStore(objstore).clear();
                    transaction.oncomplete = function () {
                        fulfill();
                    };
                });
            });
        };
        /**
         * When inserting sets of data, prefer using one upsert call with array input.
         */
        dbproto.prototype.upsert = function (storename, inputobj, ignoreError) {
            var _this = this;
            if (ignoreError === void 0) { ignoreError = true; }
            return this.load().then(function () {
                return new _this.$q(function (resolve, reject) {
                    if (!inputobj || (inputobj instanceof Array && !inputobj.length)) {
                        resolve(null);
                        return;
                    }
                    var transaction = _this.db.transaction(storename, "readwrite");
                    var store = transaction.objectStore(storename);
                    if (!(inputobj instanceof Array))
                        inputobj = [inputobj];
                    var out = [];
                    inputobj.forEach(function (o, idx) {
                        var req = store.put(o);
                        req.onsuccess = function (ev) {
                            out[idx] = ev.target.result;
                        };
                        req.onerror = function (ev) {
                            console.debug('upsert error', JSON.stringify(o));
                            if (ignoreError) {
                                ev.preventDefault();
                            }
                        };
                    });
                    transaction.oncomplete = function () {
                        //console.debug("upsert complete " + storename , inputobj);
                        if (inputobj.length == 1)
                            resolve(out[0]);
                        else
                            resolve(out);
                    };
                    transaction.onerror = function (eve) {
                        console.debug("upsert error: " + eve.target.error.message, inputobj);
                        //reject(eve.target.error);
                    };
                    transaction.onabort = function (eve) {
                        console.debug("upsert abort " + storename);
                        reject(eve.target.error);
                    };
                });
            });
        };
        dbproto.prototype.load = function () {
            var _this = this;
            if (dbproto.dbLoading[this.DBNAME])
                return dbproto.dbLoading[this.DBNAME];
            dbproto.dbLoading[this.DBNAME] = new this.$q(function (resolve, reject) {
                try {
                    if (_this.db) {
                        resolve(_this.db);
                        return;
                    }
                    var idb = (dbproto.useShim) ? shimIndexedDB : indexedDB;
                    var request = idb.open(_this.DBNAME, _this.VERSION);
                    request.onupgradeneeded = function (e) {
                        //var ne:any = Object.create(e);
                        //safari fix
                        //ne.oldversion = ( e.oldVersion > 999 ) ? 0 : Number(e.oldVersion)
                        _this.upgradeHook(e);
                    };
                    request.onsuccess = function (ev) {
                        _this.db = ev.target["result"];
                        resolve(ev.target["result"]);
                    };
                    request.onerror = function (ev) {
                        console.debug("DB load failure", ev);
                        reject(ev.target.error);
                    };
                }
                catch (er) {
                    reject(er);
                }
            });
            return dbproto.dbLoading[this.DBNAME];
        };
        dbproto.prototype.clearAll = function (names) {
            var _this = this;
            return this.load().then(function () {
                //lib.d.ts says domstringlist, so im assuming it doesnt have string prototype
                var dom_storenames = _this.db.objectStoreNames;
                if (names)
                    storenames = names;
                else {
                    var storenames = [];
                    for (var it = 0; it < dom_storenames.length; it++) {
                        storenames.push(dom_storenames[it]);
                    }
                }
                var allp = storenames.map(function (name) {
                    return new _this.$q(function (resolve, reject) {
                        var transaction = _this.db.transaction(name, "readwrite");
                        var store = transaction.objectStore(name);
                        var req = store.clear();
                        req.onsuccess = function () {
                            resolve();
                        };
                        req.onerror = function () {
                            reject();
                        };
                        req.onblocked = function () {
                            reject();
                        };
                    });
                });
                return _this.$q.all(allp);
            });
        };
        dbproto.prototype.deleteDatabase = function (name) {
            var idb = (dbproto.useShim) ? shimIndexedDB : indexedDB;
            idb.deleteDatabase(name);
        };
        dbproto.dbLoading = {};
        return dbproto;
    })();
    dbprotoNs.dbproto = dbproto;
})(dbprotoNs || (dbprotoNs = {}));
var dbproto = dbprotoNs.dbproto;
