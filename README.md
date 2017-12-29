# dbproto

Basic IndexedDB wrapper.

### init

```javascript
var db = new dbproto('database_name',12,$q);
db.upgradeHook = (event) => {
	//onupgrade hook goes here
}
db.query('my_store').then( r => console.log(r) )
```

Currently `dbproto` is defined as a global variable.

(NEW) Now also suports UMD `require('dbproto')`.

### constructor

	constructor(name:string,version:string,promise?:any)

`promise` allows you to pass Angular's `$q` (or any other promise implementation), so that db operations trigger a scope digest.

### upgradeHook

```typescript
upgradeHook(event:IDBVersionChangeEvent)
```
 
Wraps [`IDBOpenRequest:onupgradeneeded`](https://developer.mozilla.org/en-US/docs/Web/API/IDBOpenDBRequest/onupgradeneeded).

### query

```typescript
query(objstore:string, queryOptions?:DbQueryOptions):Promise<any[]>
```

Everything query.
 
```typescript
db.query('object_store').then( r => console.log(r) )
```
	 
Gets the whole object store.

OPTIONAL:

```typescript
interface DbQueryOptions {
	//define a function to filter each output
	filterFunc? : (input:any) => boolean;
	//use a index
	index? : string;
	//use a key range
	keyRange? : IDBKeyRange;
}
```

```typescript
db.query('object_store' , { index : 'my_index' , keyRange : IDBKeyRange.only(123) })
	.then( r => console.log(r) )
```

### getObject

```typescript
getObject(objstore:string, id:string|number|any[]):Promise<any>
```

Gets a single object, based on the primary key (keypath).


### getByIndex

```typescript
getByIndex(store_name:string, indexName:string, value:IDBKeyRange|string|number|string[]|number[]):Promise<any[]>
```

Queries some index. If the parameter is not an IDBKeyRange, we wrap it with `IDBKeyRange.only`.

### upsert

```typescript
upsert(storename:string, inputobj:any|any[], ignoreError:boolean = true):Promise<any>
```

Inserts/replaces objects. `ignoreError` controls whether the whole transaction is aborted
or if just an error is logged when problems like failed constraints arise.


### deleteObject

```typescript
deleteObject(store_name:string, key:number|string|any[]):Promise<any>
```

Removes an entry(ies) based on the key path.

### clearAll

```typescript
clearAll(storeNames?:string[]):Promise<any>
```

Clears the selected object stores (all stores on no parameter passed).


### load

```typescript
load():Promise<any>
```

Load is internally called in all the other methods. You don't need to call it.


### deleteDatabase

```typescript
deleteDatabase(name:string)
```


### augmentJoin

```typescript
augmentJoin(srcObject:any, joinBy:JoinSpec[]|JoinSpec) : Promise<any>
```

Transforms an object, replacing fields with query results. Just in case stores have
some relational-like structure...

```typescript
export interface JoinSpec {

    //the field which will have the queried data injected
    sourceContainer : string;
    //the field which data will be passed to the query
    //if empty, used sourceContainer
    sourceField? : any;
    //the store to be queried
    destStore : string | ((store:any) => string);
    //the index from the queried store. Gets key path if empty.
    destIndex? : string;
    cardinality : Cardinality;

}
```

Example
```
src = {
	customerId : 123 ,
	customer : null ,
	phoneNumbers : null
}

 db.augmentJoin(src,[
 	{ sourceContainer : 'customer'  , sourceField : 'customerId' ,
 		destStore : 'customer_store' , cardinality : dbproto.Cartinality.ONE } ,
 	{ sourceContainer : 'phoneNumbers' , sourceField : 'customerId' , 
 		destStore : 'customer_phone' , destIndex : 'customer_id' , 
 		cardinality : dbproto.Cardinality.MANY }
 ]).then( ... )

 	===>

{
	customerId : 123 ,
	customer : { name : 'John' } ,
	phoneNumbers : [{ phone : 1234 } , { phone : 4567 }]
}
```

## IndexedDbShim

We try to use the [indexed DB shim](https://github.com/axemclion/IndexedDBShim)
when on IOS or safari. It must be previously loaded for that.
