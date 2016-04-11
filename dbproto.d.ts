/// <reference path="typings/es6-promise/es6-promise.d.ts" />
declare var shimIndexedDB: any;
declare module dbprotoNs {
    interface DbQueryOptions {
        filters?: any[];
        filterFunc?: (input: any) => boolean;
        index?: string;
        keyRange?: IDBKeyRange;
    }
    enum Cardinality {
        ONE = 0,
        MANY = 1,
    }
    interface JoinSpec {
        sourceContainer: string;
        sourceField?: any;
        destStore: string | ((store: any) => string);
        destIndex?: string;
        cardinality: Cardinality;
    }
    /**
     * IndexedDB wrappers
     */
    class dbproto {
        DBNAME: string;
        VERSION: number;
        db: IDBDatabase;
        $q: any;
        static useShim: boolean;
        /**
         * @param promise - Passing in a promise factory allows us to override
         * the default promise with angular's Q, which in turn bundles some 2-way data
         * binding thing along.
         */
        constructor(DBNAME: string, VERSION: number, promise?: any);
        /**
         * Override to set the upgrade hook.
         */
        upgradeHook(e: any): void;
        query(objstore: string, queryOptions?: DbQueryOptions): Promise<any[]>;
        _applyFilter(filterArr: any[], object: any): boolean;
        /**
         * Replaces fields in srcObject with queried data.
         * See JoinSpec.
         */
        augmentJoin(srcObject: any, joinBy: JoinSpec[] | JoinSpec): Promise<any>;
        /**
         * Queries based on primary key
         */
        getObject(objstore: string, id: string | number | any[]): Promise<any>;
        deleteObject(store_name: string, key: number | string | any[]): Promise<any>;
        getByIndex(store_name: string, indexName: string, value: IDBKeyRange | string | number | string[] | number[]): Promise<any[]>;
        clear(objstore: string): Promise<any>;
        /**
         * When inserting sets of data, prefer using one upsert call with array input.
         */
        upsert(storename: string, inputobj: any | any[], ignoreError?: boolean): Promise<any>;
        static dbLoading: {};
        load(): Promise<any>;
        clearAll(names?: string[]): Promise<any>;
        deleteDatabase(name: string): void;
    }
}
declare var dbproto: typeof dbprotoNs.dbproto;
