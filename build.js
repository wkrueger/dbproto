const build = require('buildscript-utils')

const tasks = {
    async bundle() {
        await build.spawn('./node_modules/.bin/webpack')
    },

    test() {
        const Server = require('karma').Server
        new Server({
            configFile: __dirname + '/karma.conf.js',
            singleRun: true
        }).start()
    }
}

build.runTask(tasks)