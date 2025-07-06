// src/repositories/MemgraphRepository.js
const BaseRepository = require('./BaseRepository');
const { getMemgraphSession } = require('../config/database');

class MemgraphRepository extends BaseRepository {
    constructor(nodeLabel = null) {
        super(null, 'memgraph'); // dbType = memgraph, db wird nicht direkt verwendet
        this.nodeLabel = nodeLabel;
    }

    async connect() {
        // Connectivity Test
        const session = getMemgraphSession();
        try {
            await session.run('RETURN 1 as test');
            console.log('✅ Memgraph connection test successful');
            return true;
        } catch (error) {
            console.error('❌ Memgraph connection test failed:', error.message);
            throw error;
        } finally {
            await session.close();
        }
    }

    
    async executeQuery(query, params = {}) {
        const session = getMemgraphSession();
        try {
            const result = await session.run(query, params);
            return result.records.map(record => {
                const obj = {};
                record.keys.forEach((key, index) => {
                    const value = record._fields[index];

                    // Handle Neo4j specific types
                    if (value && value.properties) {
                        // Node
                        obj[key] = {
                            vertex_id: value.identity.toNumber(),
                            labels: value.labels,
                            ...value.properties
                        };
                    } else if (value && value.low !== undefined) {
                        // Integer
                        obj[key] = value.toNumber();
                    } else {
                        obj[key] = value;
                    }
                });

                return record.keys.length === 1 ? obj[record.keys[0]] : obj;
            });
        } catch (error) {
            throw new Error(`Memgraph Query Fehler: ${error.message}`);
        } finally {
            await session.close();
        }
    }

    async close() {
        // Individual sessions werden automatisch geschlossen
        // Driver wird in database.js verwaltet
        console.log('✅ MemgraphRepository sessions closed');
    }

    // Health Check
    async healthCheck() {
        try {
            await this.connect();
            return { status: 'ok', database: 'memgraph' };
        } catch (error) {
            return { status: 'error', database: 'memgraph', error: error.message };
        }
    }
}

module.exports = MemgraphRepository;