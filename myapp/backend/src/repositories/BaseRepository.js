// src/repositories/BaseRepository.js
const { OracleGraphRESTClient } = require('../services/OracleGraphRESTClient');

class BaseRepository {
    constructor(db, dbType) {
        this.dbType = dbType;

        // Oracle Property Graph Client für Oracle-Queries
        if (dbType === 'oracle') {
            this.pgClient = new OracleGraphRESTClient();
            this.defaultGraph = 'ALL_GRAPH';
        }
    }

    // Hauptmethode: Query ausführen
    async execute(queries, params = {}) {
        const query = queries[this.dbType];

        if (!query) {
            throw new Error(`Keine Query für Datenbanktyp ${this.dbType} definiert`);
        }

        if (this.dbType === 'oracle') {
            return await this.executeOraclePGQL(query, params);
        } else if (this.dbType === 'memgraph') {
            return await this.executeMemgraphFixed(query, params);
        }

        throw new Error(`Unbekannter Datenbanktyp: ${this.dbType}`);
    }

    // Oracle PGQL Query ausführen
    async executeOraclePGQL(query, params = {}) {
        try {
            // Authentication sicherstellen
            if (!this.pgClient.token) {
                await this.pgClient.authenticate();
            }

            // Parameter in Query ersetzen (PGQL verwendet keine Prepared Statements)
            let processedQuery = query;
            for (const [key, value] of Object.entries(params)) {
                const paramPlaceholder = new RegExp(`:${key}\\b`, 'g');
                const paramValue = typeof value === 'string' ? `'${value}'` : value;
                processedQuery = processedQuery.replace(paramPlaceholder, paramValue);
            }

            console.log('🔍 Oracle PGQL Query:', processedQuery);

            const result = await this.pgClient.runPGQLQuery(processedQuery);

            if (!result?.results?.[0]?.success) {
                const error = result?.results?.[0]?.error || 'PGQL Query failed';
                throw new Error(`Oracle PGQL Error: ${error}`);
            }

            return this.parseOraclePGQLResult(result);

        } catch (error) {
            console.error('Oracle PGQL Fehler:', error.message);
            throw error;
        }
    }

    // Memgraph Query ausführen - COMPLETE REWRITE
    async executeMemgraphFixed(query, params = {}) {
        let session;
        try {
            // ALWAYS import session directly - no dependency on this.db
            const { getMemgraphSession } = require('../config/database');
            session = getMemgraphSession();

            if (!session || !session.run) {
                throw new Error('Invalid Memgraph session - check database config');
            }

            // Parameter direkt in Query einbauen (umgeht Neo4j Parameter-Bug)
            let processedQuery = query;

            // Numeric parameters
            if (params.limit !== undefined) {
                const limitValue = typeof params.limit === 'string' ? parseInt(params.limit, 10) : params.limit;
                processedQuery = processedQuery.replace(/\$limit\b/g, limitValue.toString());
            }

            if (params.offset !== undefined) {
                const offsetValue = typeof params.offset === 'string' ? parseInt(params.offset, 10) : params.offset;
                processedQuery = processedQuery.replace(/\$offset\b/g, offsetValue.toString());
            }

            // String parameters
            for (const [key, value] of Object.entries(params)) {
                if (key !== 'limit' && key !== 'offset' && typeof value === 'string') {
                    const escapedValue = value.replace(/'/g, "\\'");
                    processedQuery = processedQuery.replace(new RegExp(`\\$${key}\\b`, 'g'), `'${escapedValue}'`);
                }
            }

            console.log('🔍 Memgraph Query (FIXED):', processedQuery);

            // Query OHNE Parameter-Objekt ausführen
            const result = await session.run(processedQuery);

            // Records konvertieren
            const records = result.records.map(record => {
                const obj = {};
                record.keys.forEach((key, index) => {
                    const value = record._fields[index];

                    if (value && value.properties) {
                        // Neo4j Node
                        obj[key] = {
                            ...value.properties,
                            _labels: value.labels,
                            _id: value.identity?.toString()
                        };
                    } else if (value && value.low !== undefined) {
                        // Neo4j Integer
                        obj[key] = value.toNumber ? value.toNumber() : value.low;
                    } else {
                        obj[key] = value;
                    }
                });

                return record.keys.length === 1 ? obj[record.keys[0]] : obj;
            });

            return records;

        } catch (error) {
            console.error('Memgraph Query Fehler:', error.message);
            throw error;
        } finally {
            if (session && session.close) {
                await session.close();
            }
        }
    }

    // Oracle PGQL Ergebnis parsen
    parseOraclePGQLResult(result) {
        try {
            const data = JSON.parse(result.results[0].result);

            if (data.table) {
                const lines = data.table.split('\n').filter(line => line.trim());
                if (lines.length <= 1) return [];

                const headers = lines[0].split('\t');
                const rows = lines.slice(1).map(line => {
                    const values = line.split('\t');
                    const row = {};
                    headers.forEach((header, index) => {
                        row[header] = values[index] || null;
                    });
                    return row;
                });

                return rows;
            }

            return data;

        } catch (parseError) {
            console.warn('Could not parse Oracle PGQL result:', parseError.message);
            return result;
        }
    }

    // Health Check
    async healthCheck() {
        try {
            if (this.dbType === 'oracle') {
                await this.pgClient.authenticate();
                return { status: 'ok', database: 'oracle_property_graph' };
            } else {
                const result = await this.execute({
                    memgraph: 'RETURN 1 as test'
                });
                return { status: 'ok', database: 'memgraph', testResult: result };
            }
        } catch (error) {
            return { status: 'error', database: this.dbType, error: error.message };
        }
    }
}

module.exports = BaseRepository;