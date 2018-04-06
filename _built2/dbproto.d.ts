declare global  {
    interface Window {
        shimIndexedDB?: any;
    }
    namespace DbProtoTypes {
        interface Stores {
        }
    }
}
export declare type AnyObject = {
    [k: string]: any;
};
export interface DbQueryOptions {
    filters?: any[];
    filterFunc?: (input: any) => boolean;
    index?: string;
    keyRange?: IDBKeyRange;
}
export declare enum Cardinality {
    ONE = 0,
    MANY = 1,
}
export interface JoinSpec {
    sourceContainer: string;
    sourceField?: any;
    destStore: string | ((store: any) => string);
    destIndex?: string;
    cardinality: Cardinality;
}
/**
 * IndexedDB wrappers
 */
export declare class dbproto {
    DBNAME: string;
    VERSION: number;
    db?: IDBDatabase;
    $q: typeof Promise;
    static useShim: boolean;
    static Cardinality: typeof Cardinality;
    /**
     * @param promise - Passing in a promise factory allows us to override
     * the default promise with angular's Q, which in turn bundles some 2-way data
     * binding thing along.
     */
    constructor(DBNAME: string, VERSION: number, promise?: any);
    /**
     * Override to set the upgrade hook.
     */
    upgradeHook(e: IDBVersionChangeEvent): void;
    query<K extends keyof DbProtoTypes.Stores>(objstore: K, queryOptions?: DbQueryOptions): Promise<DbProtoTypes.Stores[K][]>;
    _applyFilter(filterArr: any[], object: any): boolean;
    /**
     * Replaces fields in srcObject with queried data.
     * See JoinSpec.
     */
    augmentJoin(srcObject: any, joinBy: JoinSpec[] | JoinSpec): Promise<any>;
    /**
     * Queries based on primary key
     */
    getObject<K extends keyof DbProtoTypes.Stores>(objstore: K, id: string | number | any[]): Promise<DbProtoTypes.Stores[K] | undefined>;
    deleteObject(store_name: string, key: number | string | any[]): Promise<any>;
    getByIndex<K extends keyof DbProtoTypes.Stores>(store_name: K, indexName: string, value: IDBKeyRange | string | number | string[] | number[]): Promise<DbProtoTypes.Stores[K][]>;
    clear(objstore: string): Promise<any>;
    /**
     * When inserting sets of data, prefer using one upsert call with array input.
     * Returns the keypath value from the inserted entry.
     */
    upsert<K extends keyof DbProtoTypes.Stores>(storename: K, _inputobj: DbProtoTypes.Stores[K] | DbProtoTypes.Stores[K][], ignoreError?: boolean): Promise<any>;
    static dbLoading: {
        [k: string]: Promise<IDBDatabase>;
    };
    load(): Promise<IDBDatabase>;
    clearAll(names?: string[]): Promise<any[]>;
    deleteDatabase(name: string): void;
}
