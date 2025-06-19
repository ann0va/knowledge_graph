// src/repositories/index.js
const BaseRepository = require('./BaseRepository');
const OracleRepository = require('./OracleRepository');
const MemgraphRepository = require('./MemgraphRepository');

module.exports = {
    BaseRepository,
    OracleRepository,
    MemgraphRepository
};