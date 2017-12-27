declare global {
    interface Window {
        shimIndexedDB? : any
    }
}


export type AnyObject = { [k:string] : any }


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

    db:IDBDatabase;
    $q : typeof Promise;

    static useShim:boolean;
    static Cardinality = Cardinality


    /**
     * @param promise - Passing in a promise factory allows us to override
     * the default promise with angular's Q, which in turn bundles some 2-way data
     * binding thing along.
     */
    constructor(public DBNAME:string, public VERSION:number, promise?:any) {
        this.$q = promise || Promise;
        var check = browserCheck();
        if ((check.ios || check.safari) && typeof window.shimIndexedDB !== "undefined")
            dbproto.useShim = true;
    }



    /**
     * Override to set the upgrade hook.
     */
    upgradeHook(e:IDBVersionChangeEvent) {
    }



    query(objstore:string, queryOptions:DbQueryOptions = {}):Promise<any[]> {
        return this.load().then(() => {
            return new this.$q<any[]>((ok, fail) => {

                var ret : any[] = [];
                var transaction = this.db.transaction(objstore, 'readonly');
                var store = transaction.objectStore(objstore);
                var index = (queryOptions.index) ? store.index(queryOptions.index) : store;
                var cursor = index.openCursor(queryOptions.keyRange || undefined);
                
                cursor.onsuccess = e => {
                    let result : IDBCursor & {value:any} = (<any>e.target).result
                    if (result) {
                        if (queryOptions.filters) {
                            if (this._applyFilter(queryOptions.filters, result.value)) {
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

                cursor.onerror = () => {
                    fail(Error());
                };

                transaction.oncomplete = () => {
                    ok(ret);
                };
            });
        });
    }



    _applyFilter(filterArr:any[], object:any) : boolean {
        var targetDesc = filterArr[0];
        var operator = filterArr[1];
        var compareTo = filterArr[2];
        var target = object[targetDesc];
        if (operator == "=") {
            if (target == compareTo) return true;
        }
        return false
    }



    /**
     * Replaces fields in srcObject with queried data.
     * See JoinSpec.
     */
    augmentJoin(srcObject:any, joinBy:JoinSpec[]|JoinSpec) : Promise<any> {

        var joinByArr:JoinSpec[] = (joinBy instanceof Array) ? joinBy : [<JoinSpec>joinBy];

        var alljoins = joinByArr.map(j => {
            if (!j.sourceField) j.sourceField = j.sourceContainer;

            var deststore:string = (typeof j.destStore == "string") ? j.destStore : j.destStore(srcObject);
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



    getByIndex(
        store_name:string, 
        indexName:string, 
        value:IDBKeyRange|string|number|string[]|number[]
    ):Promise<any[]> {
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
    upsert(storename:string, _inputobj:AnyObject|any[], ignoreError:boolean = true):Promise<any> {
        return this.load().then(() => {
            return new this.$q((resolve, reject) => {

                if (!_inputobj || (_inputobj instanceof Array && !_inputobj.length)) {
                    resolve();
                    return;
                }

                var transaction = this.db.transaction(storename, "readwrite");
                var store = transaction.objectStore(storename);

                let treatedInp = _inputobj instanceof Array ? _inputobj : [_inputobj]

                var out = [] as any[];

                treatedInp.forEach((o, idx) => {
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
                    if (treatedInp.length == 1) resolve(out[0]);
                    else resolve(out);
                };

                transaction.onerror = (eve:any) => {
                    console.debug("upsert error: " + eve.target.error.message, _inputobj);
                    //reject(eve.target.error);
                };

                transaction.onabort = (eve) => {
                    console.debug("upsert abort " + storename);
                    reject((<any>eve.target).error);
                }
            });

        });
    }



    static dbLoading : { [k:string] : Promise<IDBDatabase> } = {};

    load() : Promise<any> {

        if (dbproto.dbLoading[this.DBNAME]) return dbproto.dbLoading[this.DBNAME];

        dbproto.dbLoading[this.DBNAME] = new this.$q((resolve, reject) => {
            try {
                if (this.db) {
                    resolve(this.db);
                    return;
                }

                var idb = (dbproto.useShim) ? window.shimIndexedDB : indexedDB;
                var request = idb.open(this.DBNAME, this.VERSION);

                request.onupgradeneeded = (e:IDBVersionChangeEvent) => {
                    //var ne:any = Object.create(e);
                    //safari fix
                    //ne.oldversion = ( e.oldVersion > 999 ) ? 0 : Number(e.oldVersion)
                    this.upgradeHook(e);
                };
                request.onsuccess = (ev:any) => {
                    this.db = ev.target["result"];
                    resolve(ev.target["result"]);
                };
                request.onerror = (ev:any) => {
                    console.debug("DB load failure", ev);
                    reject(ev.target.error);
                };
            } catch (er) {
                reject(er);
            }
        });

        return dbproto.dbLoading[this.DBNAME];
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
                return new this.$q((resolve, reject) => {
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
        var idb = (dbproto.useShim) ? window.shimIndexedDB : indexedDB;
        idb.deleteDatabase(name);
    }

}