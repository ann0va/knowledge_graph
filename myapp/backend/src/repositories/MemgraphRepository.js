// src/repositories/MemgraphRepository.js - Fixed für Session Handling
const BaseRepository = require('./BaseRepository');
const { getMemgraphSession } = require('../config/database');

class MemgraphRepository extends BaseRepository {
    constructor(nodeLabel = null) {
        super(null, 'memgraph'); // dbType = memgraph, db wird nicht direkt verwendet
        this.nodeLabel = nodeLabel;
    }

    // Session Provider für BaseRepository
    getMemgraphSession() {
        return getMemgraphSession();
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

    async create(data) {
        if (!this.nodeLabel) {
            throw new Error('NodeLabel is required for create operation');
        }

        const session = getMemgraphSession();
        try {
            const properties = Object.entries(data)
                .map(([key, value]) => `${key}: $${key}`)
                .join(', ');

            const query = `
                CREATE (n:${this.nodeLabel} {${properties}})
                RETURN id(n) as vertex_id, n
            `;

            const result = await session.run(query, data);

            if (result.records.length === 0) {
                throw new Error('No records returned from create operation');
            }

            const record = result.records[0];
            const vertexId = record.get('vertex_id').toNumber();
            const node = record.get('n');

            return {
                vertex_id: vertexId,
                ...node.properties
            };
        } catch (error) {
            throw new Error(`Memgraph Create Fehler: ${error.message}`);
        } finally {
            await session.close();
        }
    }

    async read(query = {}) {
        if (!this.nodeLabel) {
            throw new Error('NodeLabel is required for read operation');
        }

        const session = getMemgraphSession();
        try {
            let cypherQuery = `MATCH (n:${this.nodeLabel})`;
            const conditions = [];
            const params = {};

            if (query.where) {
                Object.entries(query.where).forEach(([key, value]) => {
                    conditions.push(`n.${key} = $${key}`);
                    params[key] = value;
                });

                if (conditions.length > 0) {
                    cypherQuery += ` WHERE ${conditions.join(' AND ')}`;
                }
            }

            cypherQuery += ' RETURN id(n) as vertex_id, n';

            if (query.orderBy) {
                cypherQuery += ` ORDER BY n.${query.orderBy}`;
            }

            if (query.limit) {
                cypherQuery += ` LIMIT ${query.limit}`;
            }

            const result = await session.run(cypherQuery, params);

            return result.records.map(record => {
                const vertexId = record.get('vertex_id').toNumber();
                const node = record.get('n');
                return {
                    vertex_id: vertexId,
                    ...node.properties
                };
            });
        } catch (error) {
            throw new Error(`Memgraph Read Fehler: ${error.message}`);
        } finally {
            await session.close();
        }
    }

    async update(id, data) {
        if (!this.nodeLabel) {
            throw new Error('NodeLabel is required for update operation');
        }

        const session = getMemgraphSession();
        try {
            const updates = Object.entries(data)
                .map(([key, value]) => `n.${key} = $${key}`)
                .join(', ');

            const query = `
                MATCH (n:${this.nodeLabel})
                WHERE n.id = $id
                SET ${updates}
                RETURN id(n) as vertex_id, n
            `;

            const result = await session.run(query, { id, ...data });

            return { rowsAffected: result.records.length };
        } catch (error) {
            throw new Error(`Memgraph Update Fehler: ${error.message}`);
        } finally {
            await session.close();
        }
    }

    async delete(id) {
        if (!this.nodeLabel) {
            throw new Error('NodeLabel is required for delete operation');
        }

        const session = getMemgraphSession();
        try {
            const query = `
                MATCH (n:${this.nodeLabel})
                WHERE n.id = $id
                DELETE n
                RETURN COUNT(n) as deleted
            `;

            const result = await session.run(query, { id });
            const deletedCount = result.records[0].get('deleted').toNumber();

            return { rowsAffected: deletedCount };
        } catch (error) {
            throw new Error(`Memgraph Delete Fehler: ${error.message}`);
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