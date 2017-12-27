import clazz = require('./_built2/dbproto')

declare global {
    declare var dbproto : typeof clazz.dbproto
}

export = dbproto