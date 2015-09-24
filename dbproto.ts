///<reference path="typings/es6-promise/es6-promise.d.ts"/>

declare var shimIndexedDB;

module dbprotoNs {

    export interface DbQueryOptions {

        //not implemented
        filters? : any[];
        //define a function to filter each output
        filterFunc? : (input:any) => boolean;
        //use a index
        index? : string;
        //use a key range
        keyRange? : IDBKeyRange;

    }

    export enum Cardinality {
        ONE, MANY
    }


    export interface JoinSpec {

        //the field which will have the queried data injected
        sourceContainer : string;
        //the field which data will be passed to the query
        //if empty, used sourceContainer
        sourceField? : any;
        //the store to be queried
        destStore : string | ((store:any) => string);
        //the index from the queried store
        destIndex? : string;
        cardinality : Cardinality;

    }

    export interface JoinedStore {

        joined : {}

    }


    //partial
    function browserCheck() {

        var UA = navigator.userAgent;

        var out:any = {};

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
    export class dbproto {

        version:number;
        dbname:string;
        db:IDBDatabase;
        $q:any;

        static useShim:boolean;

        /**
         * @param promise - Passing in a promise factory allows us to override
         * the default promise with angular's Q, which in turn bundles some 2-way data
         * binding thing along.
         */
        constructor(public DBNAME:string, public VERSION:number, promise?:any) {
            this.$q = promise || Promise;
            var check = browserCheck();
            if ((check.ios || check.safari) && typeof shimIndexedDB !== "undefined") dbproto.useShim = true;
        }

        /**
         * Override to set the upgrade hook.
         * oldversion is
         */
        upgradeHook(e) {
        }


        query(objstore:string, queryOptions?:DbQueryOptions):Promise<any[]> {

            queryOptions = queryOptions || {};

            return this.load().then(() => {
                return new this.$q((ok, fail) => {

                    var ret = [];
                    var transaction = this.db.transaction(objstore, 'readonly');
                    var store = transaction.objectStore(objstore);
                    var index:any = (queryOptions.index) ? store.index(queryOptions.index) : store;
                    var cursor = index.openCursor(queryOptions.keyRange || null);

                    cursor.onsuccess = (e:any) => {

                        if (e.target.result) {
                            if (queryOptions.filters) {
                                if (this._applyFilter(queryOptions.filters, e.target.result.value)) {
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

                    cursor.onerror = () => {
                        fail(Error());
                    };

                    transaction.oncomplete = () => {
                        ok(ret);
                    };
                });
            });

        }

        _applyFilter(filterArr:any[], object:any):boolean {

            var targetDesc = filterArr[0];
            var operator = filterArr[1];
            var compareTo = filterArr[2];

            var target = object[targetDesc];

            if (operator == "=") {
                if (target == compareTo) return true;
            }

        }

        /**
         * Replaces fields in srcObject with queried data.
         * See JoinSpec.
         */
        augmentJoin(srcObject:any, joinBy:JoinSpec[]|JoinSpec) : Promise<any> {

            var joinByArr:JoinSpec[] = (joinBy instanceof Array) ? joinBy : [<JoinSpec>joinBy];

            var alljoins = joinByArr.map(j => {

                if (!j.sourceField) j.sourceField = j.sourceContainer;

                var deststore:string = (typeof j.destStore == "string") ? <string>j.destStore : (<(i:any)=>string>j.destStore)(srcObject);

                var f;

                if (j.destIndex) f = this.getByIndex(deststore, j.destIndex, srcObject[j.sourceField]);
                else f = this.getObject(deststore, srcObject[j.sourceField]).then(r => {
                    return [r];
                });

                return f.then(r => {

                    if (!r) throw new Error('getAndJoin: item to join not found.');
                    srcObject[j.sourceContainer || j.sourceField] = (j.cardinality == Cardinality.ONE) ? r[0] : r;

                });

            });

            return this.$q.all(alljoins).then(() => {
                return srcObject;
            });

        }


        /**
         * Queries based on primary key
         */
        getObject(objstore:string, id:string|number|any[]):Promise<any> {

            var that = this;
            return this.load().then(() => {

                return new this.$q((ok, fail) => {

                    var transaction = that.db.transaction(objstore, 'readonly');
                    var store = transaction.objectStore(objstore);
                    try {
                        var res = store.get(id);
                    } catch (err) {
                        fail(Error(`getObject objstore.get failed on id: ${id} objstore: ${objstore}`));
                        throw err;
                    }

                    transaction.oncomplete = () => {
                        ok(res.result);
                    };

                    transaction.onerror = () => {
                        fail(Error());
                    }

                });

            });
        }


        deleteObject(store_name:string, key:number|string|any[]):Promise<any> {

            var that = this;
            return this.load().then(() => {

                return new this.$q((resolve, reject) => {

                    var transaction = that.db.transaction(store_name, 'readwrite');
                    var store = transaction.objectStore(store_name);
                    var res = store.delete(key);

                    transaction.oncomplete = () => {
                        resolve(res.result);
                    };

                    transaction.onerror = () => {
                        reject(Error());
                    };
                });

            });

        }


        getByIndex(store_name:string, indexName:string, value:IDBKeyRange|string|number|string[]|number[]):Promise<any[]> {

            if (typeof value == "string" || typeof value == "number") value = IDBKeyRange.only(value);

            return this.query(store_name,
                {index: indexName, keyRange: <IDBKeyRange>value}
            );

        }


        clear(objstore:string):Promise<any> {

            return this.load().then(() => {

                return new this.$q((fulfill) => {

                    var transaction = this.db.transaction(objstore, "readwrite");
                    transaction.objectStore(objstore).clear();

                    transaction.oncomplete = () => {
                        fulfill();
                    };
                });

            });

        }

        /**
         * When inserting sets of data, prefer using one upsert call with array input.
         */
        upsert(storename:string, inputobj:any|any[], ignoreError:boolean = true):Promise<any> {


            return this.load().then(() => {

                return this.$q((resolve, reject) => {

                    if (!inputobj || (inputobj instanceof Array && !inputobj.length)) {
                        resolve(null);
                        return;
                    }

                    var transaction = this.db.transaction(storename, "readwrite");
                    var store = transaction.objectStore(storename);

                    if (!(inputobj instanceof Array)) inputobj = [inputobj];

                    var out = [];

                    inputobj.forEach((o, idx) => {

                        var req = store.put(o);

                        req.onsuccess = function (ev:any) {

                            out[idx] = ev.target.result;

                        };

                        req.onerror = function (ev:Event) {

                            console.debug('upsert error', JSON.stringify(o));
                            if (ignoreError) {
                                ev.preventDefault();
                            }

                        }


                    });


                    transaction.oncomplete = () => {
                        //console.debug("upsert complete " + storename , inputobj);
                        if (inputobj.length == 1) resolve(out[0]);
                        else resolve(out);
                    };

                    transaction.onerror = (eve:any) => {
                        console.debug("upsert error: " + eve.target.error.message, inputobj);
                        //reject(eve.target.error);
                    };

                    transaction.onabort = (eve) => {
                        console.debug("upsert abort " + storename);
                        reject((<any>eve.target).error);
                    }

                });

            });
        }


        static dbLoading = {};

        load():Promise<any> {

            if (dbproto.dbLoading[this.dbname]) return dbproto.dbLoading[this.dbname];

            dbproto.dbLoading[this.dbname] = this.$q((resolve, reject) => {

                try {

                    if (this.db) {
                        resolve(this.db);
                        return;
                    }

                    var idb = (dbproto.useShim) ? shimIndexedDB : indexedDB;

                    var request = idb.open(this.dbname, this.version);

                    request.onupgradeneeded = (e:IDBVersionChangeEvent) => {

                        var ne:any = Object.create(e);
                        ne.oldversion = ( e.oldVersion > 999 ) ? 0 : Number(e.oldVersion)
                        this.upgradeHook(ne);

                    };

                    request.onsuccess = (ev) => {

                        this.db = ev.target["result"];
                        resolve(ev.target["result"]);

                    };

                    request.onerror = (ev) => {

                        console.debug("DB load failure", ev);
                        reject(ev.target.error);

                    };

                } catch (er) {

                    reject(er);

                }


            });

            return dbproto.dbLoading[this.dbname];
        }

        clearAll(names?:string[]):Promise<any> {

            return this.load().then(() => {

                //lib.d.ts says domstringlist, so im assuming it doesnt have string prototype
                var dom_storenames = this.db.objectStoreNames;

                if (names) storenames = names;
                else {
                    var storenames = [];
                    for (var it = 0; it < dom_storenames.length; it++) {
                        storenames.push(dom_storenames[it]);
                    }
                }

                var allp = storenames.map(name => {

                    return this.$q((resolve, reject) => {

                        var transaction = this.db.transaction(name, "readwrite");
                        var store = transaction.objectStore(name);

                        var req = store.clear();

                        req.onsuccess = () => {
                            resolve();
                        };

                        req.onerror = () => {
                            reject();
                        };

                        (<any>req).onblocked = () => {
                            reject();
                        };

                    });

                });

                return this.$q.all(allp);

            });

        }

        deleteDatabase(name:string) {

            var idb = (dbproto.useShim) ? shimIndexedDB : indexedDB;
            idb.deleteDatabase(name);

        }

    }

}

var dbproto = dbprotoNs.dbproto;