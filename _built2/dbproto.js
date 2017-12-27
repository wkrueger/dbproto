(function webpackUniversalModuleDefinition(root, factory) {
	if(typeof exports === 'object' && typeof module === 'object')
		module.exports = factory();
	else if(typeof define === 'function' && define.amd)
		define([], factory);
	else if(typeof exports === 'object')
		exports["dbproto"] = factory();
	else
		root["dbproto"] = factory();
})(typeof self !== 'undefined' ? self : this, function() {
return /******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};
/******/
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/
/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId]) {
/******/ 			return installedModules[moduleId].exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			i: moduleId,
/******/ 			l: false,
/******/ 			exports: {}
/******/ 		};
/******/
/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/
/******/ 		// Flag the module as loaded
/******/ 		module.l = true;
/******/
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/
/******/
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;
/******/
/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;
/******/
/******/ 	// define getter function for harmony exports
/******/ 	__webpack_require__.d = function(exports, name, getter) {
/******/ 		if(!__webpack_require__.o(exports, name)) {
/******/ 			Object.defineProperty(exports, name, {
/******/ 				configurable: false,
/******/ 				enumerable: true,
/******/ 				get: getter
/******/ 			});
/******/ 		}
/******/ 	};
/******/
/******/ 	// getDefaultExport function for compatibility with non-harmony modules
/******/ 	__webpack_require__.n = function(module) {
/******/ 		var getter = module && module.__esModule ?
/******/ 			function getDefault() { return module['default']; } :
/******/ 			function getModuleExports() { return module; };
/******/ 		__webpack_require__.d(getter, 'a', getter);
/******/ 		return getter;
/******/ 	};
/******/
/******/ 	// Object.prototype.hasOwnProperty.call
/******/ 	__webpack_require__.o = function(object, property) { return Object.prototype.hasOwnProperty.call(object, property); };
/******/
/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";
/******/
/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(__webpack_require__.s = 0);
/******/ })
/************************************************************************/
/******/ ([
/* 0 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

var dbproto_1 = __webpack_require__(1);
module.exports = dbproto_1.dbproto;


/***/ }),
/* 1 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", { value: true });
var Cardinality;
(function (Cardinality) {
    Cardinality[Cardinality["ONE"] = 0] = "ONE";
    Cardinality[Cardinality["MANY"] = 1] = "MANY";
})(Cardinality = exports.Cardinality || (exports.Cardinality = {}));
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
var dbproto = /** @class */ (function () {
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
        if ((check.ios || check.safari) && typeof window.shimIndexedDB !== "undefined")
            dbproto.useShim = true;
    }
    /**
     * Override to set the upgrade hook.
     */
    dbproto.prototype.upgradeHook = function (e) {
    };
    dbproto.prototype.query = function (objstore, queryOptions) {
        var _this = this;
        if (queryOptions === void 0) { queryOptions = {}; }
        return this.load().then(function () {
            return new _this.$q(function (ok, fail) {
                var ret = [];
                var transaction = _this.db.transaction(objstore, 'readonly');
                var store = transaction.objectStore(objstore);
                var index = (queryOptions.index) ? store.index(queryOptions.index) : store;
                var cursor = index.openCursor(queryOptions.keyRange || undefined);
                cursor.onsuccess = function (e) {
                    var result = e.target.result;
                    if (result) {
                        if (queryOptions.filters) {
                            if (_this._applyFilter(queryOptions.filters, result.value)) {
                                ret.push(result.value);
                            }
                        }
                        else if (queryOptions.filterFunc) {
                            if (queryOptions.filterFunc(result.value)) {
                                ret.push(result.value);
                            }
                        }
                        else {
                            ret.push(result.value);
                        }
                        result.continue();
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
        return false;
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
    dbproto.prototype.upsert = function (storename, _inputobj, ignoreError) {
        var _this = this;
        if (ignoreError === void 0) { ignoreError = true; }
        return this.load().then(function () {
            return new _this.$q(function (resolve, reject) {
                if (!_inputobj || (_inputobj instanceof Array && !_inputobj.length)) {
                    resolve();
                    return;
                }
                var transaction = _this.db.transaction(storename, "readwrite");
                var store = transaction.objectStore(storename);
                var treatedInp = _inputobj instanceof Array ? _inputobj : [_inputobj];
                var out = [];
                treatedInp.forEach(function (o, idx) {
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
                    if (treatedInp.length == 1)
                        resolve(out[0]);
                    else
                        resolve(out);
                };
                transaction.onerror = function (eve) {
                    console.debug("upsert error: " + eve.target.error.message, _inputobj);
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
                var idb = (dbproto.useShim) ? window.shimIndexedDB : indexedDB;
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
        var idb = (dbproto.useShim) ? window.shimIndexedDB : indexedDB;
        idb.deleteDatabase(name);
    };
    dbproto.Cardinality = Cardinality;
    dbproto.dbLoading = {};
    return dbproto;
}());
exports.dbproto = dbproto;


/***/ })
/******/ ]);
});