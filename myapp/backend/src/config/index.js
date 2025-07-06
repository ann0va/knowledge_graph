// src/config/index.js
require('dotenv').config();

module.exports = {
    app: {
        port: process.env.PORT || 10510,
        env: process.env.NODE_ENV || 'development'
    },
    oracle: {
        user: process.env.ORACLE_USER || 'team25s5',
        password: process.env.ORACLE_PASSWORD || 'team25s5.c017',
        connectString: process.env.ORACLE_CONNECTION_STRING || '10.20.110.68:1521/FREEPDB1'
    },
    memgraph: {
        uri: process.env.MEMGRAPH_URI || 'bolt://10.20.110.66:10500',
        user: process.env.MEMGRAPH_USER || 'team25s5',
        password: process.env.MEMGRAPH_PASSWORD || 'team25s5.c017'
    }
};