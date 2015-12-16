describe('dbproto' , function() {

    this.timeout(20000)

    var db;
    var expect = chai.expect;

    before( function(done) {
        db = new dbproto('test_db',6);
        db.upgradeHook = function(ev) {

            var dbobj = ev.target.result;
            function reset(name) {
                if (dbobj.objectStoreNames.contains(name)) {
                    dbobj.deleteObjectStore(name)
                }
            }

            reset('table1')
            dbobj.createObjectStore('table1',
                { keyPath : 'tbl_key' , autoIncrement : true });
            
            reset('table2')
            var t2 = dbobj.createObjectStore('table2',
                { keyPath : 'id' , autoIncrement : true });
            t2.createIndex('t1_ref','t1_ref',{unique:false});

        }
        db.clear('table1').then(function(){
            return db.clear('table2')
        }).then(function(){ done() })
    })


    it('insert data then get object' , function(done) {
        db.upsert('table1' , { tbl_key : 2 , name : 'test 1' })
            .then( function() {
                return db.getObject('table1',2)
            }).then( function(r) {
                expect(r).to.be.ok
                expect(r).to.have.property('name','test 1')
                done()
            })
    })


    it('insert array, query all' , function(done) {
        db.upsert('table1' , [
                { name : 'test 2' } , { name : 'test 3' }
            ] ).then( function() {
                return db.query('table1')
            }).then(function(res) {
                expect(res.length).to.be.equal(3)
                done()
            })
    })


    it('remove item' , function(done) {
        db.deleteObject('table1' , 2).then( function() {
            return db.query('table1')
        }).then(function(res) {
            expect(res.length).to.be.equal(2)
            done()
        })
    })


    it('augment join, cardinality: many' , function(done) {
        db.upsert('table1' , [
            { tbl_key : 10 , name : 'item 10' } ,
            { tbl_key : 12 , name : 'item 12' }
        ]).then( function() {
            return db.upsert('table2' , [
                { t1_ref : 10 , name : 'ref1' , id : 1 } ,
                { t1_ref : 10 , name : 'ref2' , id : 2 } ,
                { t1_ref : 12 , name : 'ref3' , id : 3 }
            ]);
        }).then(function() {
            return db.getObject('table1' , 10)
        }).then(function(res) {
            return db.augmentJoin( res , [
                {
                    sourceContainer : '_tbl2' ,
                    sourceField : 'tbl_key' ,
                    destStore : 'table2' ,
                    destIndex : 't1_ref' ,
                    cardinality : 1
                }
            ])
        }).then( function(res) {
            //debugger;// 
            expect(res).to.deep.equal({
                tbl_key : 10 ,
                name : 'item 10' ,
                _tbl2 : [
                    { t1_ref : 10 , name : 'ref1' , id : 1 } ,
                    { t1_ref : 10 , name : 'ref2' , id : 2 }
                ]
            })
            done();
        })
    })

});