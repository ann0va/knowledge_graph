// src/config/database.js
const oracledb = require('oracledb');
const neo4j = require('neo4j-driver');
const config = require('./index');

// Oracle Konfiguration
const oracleConfig = {
    user: config.oracle.user,
    password: config.oracle.password,
    connectString: config.oracle.connectString
};

// Memgraph Konfiguration (nutzt Neo4j Treiber)
const memgraphConfig = {
    uri: config.memgraph.uri,
    user: config.memgraph.user,
    password: config.memgraph.password
};

// Oracle Pool initialisieren
let oraclePool = null;

async function initializeOraclePool() {
    try {
        oraclePool = await oracledb.createPool({
            ...oracleConfig,
            poolMin: 2,
            poolMax: 10,
            poolIncrement: 1
        });
        console.log('Oracle Verbindungspool erstellt');
    } catch (err) {
        console.error('Fehler beim Erstellen des Oracle Pools:', err);
    }
}

// Memgraph Treiber initialisieren
const memgraphDriver = neo4j.driver(
    memgraphConfig.uri,
    neo4j.auth.basic(memgraphConfig.user, memgraphConfig.password),
    {
        maxConnectionPoolSize: 50,
        connectionAcquisitionTimeout: 2000
    }
);

// Verbindungsfunktionen
async function getOracleConnection() {
    if (!oraclePool) {
        await initializeOraclePool();
    }
    return await oraclePool.getConnection();
}

function getMemgraphSession() {
    return memgraphDriver.session();
}

// Cleanup Funktionen
async function closeOraclePool() {
    if (oraclePool) {
        await oraclePool.close();
    }
}

async function closeMemgraphDriver() {
    await memgraphDriver.close();
}

module.exports = {
    initializeOraclePool,
    getOracleConnection,
    getMemgraphSession,
    closeOraclePool,
    closeMemgraphDriver
};