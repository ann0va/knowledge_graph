// src/repositories/OracleRepository.js
const oracledb = require('oracledb');
const BaseRepository = require('./BaseRepository');
const { getOracleConnection } = require('../config/database');

class OracleRepository extends BaseRepository {
    constructor(tableName) {
        super();
        this.tableName = tableName;
    }

    async create(data) {
        let connection;
        try {
            connection = await getOracleConnection();

            const columns = Object.keys(data).join(', ');
            const placeholders = Object.keys(data).map((_, i) => `:${i + 1}`).join(', ');
            const values = Object.values(data);

            const query = `INSERT INTO ${this.tableName} (${columns}) VALUES (${placeholders}) RETURNING id INTO :id`;

            const result = await connection.execute(
                query,
                [...values, { type: oracledb.NUMBER, dir: oracledb.BIND_OUT }],
                { autoCommit: true }
            );

            return { id: result.outBinds.id[0], ...data };
        } catch (error) {
            throw new Error(`Oracle Create Fehler: ${error.message}`);
        } finally {
            if (connection) {
                await connection.close();
            }
        }
    }

    async read(query = {}) {
        let connection;
        try {
            connection = await getOracleConnection();

            let sqlQuery = `SELECT * FROM ${this.tableName}`;
            const conditions = [];
            const binds = {};

            if (query.where) {
                Object.entries(query.where).forEach(([key, value], index) => {
                    conditions.push(`${key} = :${index}`);
                    binds[index] = value;
                });

                if (conditions.length > 0) {
                    sqlQuery += ` WHERE ${conditions.join(' AND ')}`;
                }
            }

            if (query.orderBy) {
                sqlQuery += ` ORDER BY ${query.orderBy}`;
            }

            if (query.limit) {
                sqlQuery += ` FETCH FIRST ${query.limit} ROWS ONLY`;
            }

            const result = await connection.execute(sqlQuery, binds, {
                outFormat: oracledb.OUT_FORMAT_OBJECT
            });

            return result.rows;
        } catch (error) {
            throw new Error(`Oracle Read Fehler: ${error.message}`);
        } finally {
            if (connection) {
                await connection.close();
            }
        }
    }

    async update(id, data) {
        let connection;
        try {
            connection = await getOracleConnection();

            const updates = [];
            const binds = { id };

            Object.entries(data).forEach(([key, value], index) => {
                updates.push(`${key} = :${index}`);
                binds[index] = value;
            });

            const query = `UPDATE ${this.tableName} SET ${updates.join(', ')} WHERE id = :id`;

            const result = await connection.execute(query, binds, { autoCommit: true });

            return { rowsAffected: result.rowsAffected };
        } catch (error) {
            throw new Error(`Oracle Update Fehler: ${error.message}`);
        } finally {
            if (connection) {
                await connection.close();
            }
        }
    }

    async delete(id) {
        let connection;
        try {
            connection = await getOracleConnection();

            const query = `DELETE FROM ${this.tableName} WHERE id = :id`;
            const result = await connection.execute(query, { id }, { autoCommit: true });

            return { rowsAffected: result.rowsAffected };
        } catch (error) {
            throw new Error(`Oracle Delete Fehler: ${error.message}`);
        } finally {
            if (connection) {
                await connection.close();
            }
        }
    }

    async executeQuery(query) {
        let connection;
        try {
            connection = await getOracleConnection();
            const result = await connection.execute(query, {}, {
                outFormat: oracledb.OUT_FORMAT_OBJECT
            });
            return result.rows;
        } catch (error) {
            throw new Error(`Oracle Query Fehler: ${error.message}`);
        } finally {
            if (connection) {
                await connection.close();
            }
        }
    }
}

module.exports = OracleRepository;