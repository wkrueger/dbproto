const path = require('path')

module.exports = (env = {}) => {

    return  {
        entry : './src/index.ts',
        output : {
            path: path.resolve(__dirname, '_built2'),
            filename: 'dbproto.js',
            libraryTarget: 'umd',
            library : 'dbproto'
        },

        module: {
            rules: [
                {
                    test: [/\.ts$/, /\.tsx$/],
                    use: [
                        {
                            loader: 'ts-loader'
                        }
                    ]
                }
            ]
        },

        resolve: {
            extensions: ['.tsx', '.ts', '.js']
        }
    }

}