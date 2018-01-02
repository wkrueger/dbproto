import clazz = require('./_built2/dbproto')

declare global {
    var dbproto : typeof clazz.dbproto
}

export = dbproto