// src/repositories/BaseRepository.js - Basis-Repository mit Property Graph Support
const oracledb = require('oracledb');

class BaseRepository {
    constructor(db, dbType) {
        this.db = db;
        this.dbType = dbType;
    }

    // Führe Query aus - unterschiedliche Logik für Oracle vs Memgraph
    async execute(queries, params = {}) {
        const query = queries[this.dbType];

        if (!query) {
            throw new Error(`Keine Query für Datenbanktyp ${this.dbType} definiert`);
        }

        if (this.dbType === 'oracle') {
            return await this.executeOracle(query, params);
        } else if (this.dbType === 'memgraph') {
            return await this.executeMemgraph(query, params);
        }

        throw new Error(`Unbekannter Datenbanktyp: ${this.dbType}`);
    }

    // Oracle Query ausführen
    async executeOracle(query, params) {
        let connection;
        try {
            connection = await this.db.getConnection();

            // Optionen für bessere Ergebnisse
            const options = {
                outFormat: oracledb.OUT_FORMAT_OBJECT,
                autoCommit: true
            };

            const result = await connection.execute(query, params, options);

            // Bei SELECT: rows zurückgeben
            if (query.trim().toUpperCase().startsWith('SELECT')) {
                return result;
            }

            // Bei INSERT/UPDATE/DELETE: rowsAffected zurückgeben
            return {
                success: true,
                rowsAffected: result.rowsAffected
            };

        } catch (error) {
            console.error('Oracle Query Fehler:', error);
            throw error;
        } finally {
            if (connection) {
                try {
                    await connection.close();
                } catch (err) {
                    console.error('Fehler beim Schließen der Oracle-Verbindung:', err);
                }
            }
        }
    }

    // Memgraph Query ausführen
    async executeMemgraph(query, params) {
        try {
            const session = this.db.driver.session();

            try {
                const result = await session.run(query, params);

                // Records in einfaches Format konvertieren
                const records = result.records.map(record => {
                    const obj = {};
                    record.keys.forEach((key, index) => {
                        const value = record._fields[index];

                        // Neo4j Node zu einfachem Objekt
                        if (value && value.properties) {
                            obj[key] = {
                                ...value.properties,
                                _labels: value.labels,
                                _id: value.identity?.toString()
                            };
                        } else {
                            obj[key] = value;
                        }
                    });

                    // Wenn nur ein Feld, direkt zurückgeben
                    if (record.keys.length === 1) {
                        return obj[record.keys[0]];
                    }

                    return obj;
                });

                return records;

            } finally {
                await session.close();
            }
        } catch (error) {
            console.error('Memgraph Query Fehler:', error);
            throw error;
        }
    }

    // Hilfsmethode: Batch-Operation
    async executeBatch(queries, paramsList) {
        const results = [];

        for (const params of paramsList) {
            try {
                const result = await this.execute(queries, params);
                results.push({ success: true, result });
            } catch (error) {
                results.push({ success: false, error: error.message });
            }
        }

        return results;
    }

    // Hilfsmethode: Transaction (nur für komplexe Operationen)
    async executeTransaction(operations) {
        if (this.dbType === 'oracle') {
            return await this.executeOracleTransaction(operations);
        } else {
            return await this.executeMemgraphTransaction(operations);
        }
    }

    // Oracle Transaction
    async executeOracleTransaction(operations) {
        let connection;
        try {
            connection = await this.db.getConnection();

            // Auto-commit ausschalten
            await connection.execute('SET TRANSACTION READ WRITE');

            const results = [];
            for (const { query, params } of operations) {
                const result = await connection.execute(query, params || {});
                results.push(result);
            }

            await connection.commit();
            return results;

        } catch (error) {
            if (connection) {
                await connection.rollback();
            }
            throw error;
        } finally {
            if (connection) {
                await connection.close();
            }
        }
    }

    // Memgraph Transaction
    async executeMemgraphTransaction(operations) {
        const session = this.db.driver.session();
        const tx = session.beginTransaction();

        try {
            const results = [];
            for (const { query, params } of operations) {
                const result = await tx.run(query, params || {});
                results.push(result);
            }

            await tx.commit();
            return results;

        } catch (error) {
            await tx.rollback();
            throw error;
        } finally {
            await session.close();
        }
    }
}

module.exports = BaseRepository;