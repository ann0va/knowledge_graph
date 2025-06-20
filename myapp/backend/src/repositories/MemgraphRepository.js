// src/repositories/MemgraphRepository.js
const BaseRepository = require('./BaseRepository');
const { getMemgraphSession } = require('../config/database');

class MemgraphRepository extends BaseRepository {
    constructor(nodeLabel) {
        super();
        this.nodeLabel = nodeLabel;
    }

    async connect() {
        // Beispiel: auf Connectivity testen
        const session = getMemgraphSession();
        try {
            await session.run('RETURN 1');
        } finally {
            await session.close();
        }
    }
    async create(data) {
        const session = getMemgraphSession();
        try {
            const properties = Object.entries(data)
                .map(([key, value]) => `${key}: $${key}`)
                .join(', ');

            const query = `
        CREATE (n:${this.nodeLabel} {${properties}})
        SET n.id = ID(n)
        RETURN n
      `;

            const result = await session.run(query, data);
            const node = result.records[0].get('n');

            return {
                id: node.properties.id.toNumber(),
                ...node.properties
            };
        } catch (error) {
            throw new Error(`Memgraph Create Fehler: ${error.message}`);
        } finally {
            await session.close();
        }
    }

    async read(query = {}) {
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

            cypherQuery += ' RETURN n';

            if (query.orderBy) {
                cypherQuery += ` ORDER BY n.${query.orderBy}`;
            }

            if (query.limit) {
                cypherQuery += ` LIMIT ${query.limit}`;
            }

            const result = await session.run(cypherQuery, params);

            return result.records.map(record => {
                const node = record.get('n');
                return {
                    id: node.properties.id ? node.properties.id.toNumber() : null,
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
        const session = getMemgraphSession();
        try {
            const updates = Object.entries(data)
                .map(([key, value]) => `n.${key} = $${key}`)
                .join(', ');

            const query = `
        MATCH (n:${this.nodeLabel})
        WHERE n.id = $id
        SET ${updates}
        RETURN n
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

    async executeQuery(query) {
        const session = getMemgraphSession();
        try {
            const result = await session.run(query);
            return result.records.map(record => record.toObject());
        } catch (error) {
            throw new Error(`Memgraph Query Fehler: ${error.message}`);
        } finally {
            await session.close();
        }
    }
}

module.exports = MemgraphRepository;