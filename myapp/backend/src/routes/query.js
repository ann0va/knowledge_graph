// src/routes/query.js - Raw Queries + Structured Queries kombiniert
const express = require('express');
const router = express.Router();

module.exports = repositoryFactory => {

    // 🎯 POST /api/query - DEINE BESTEHENDE Raw Query Execution
    router.post('/', async (req, res) => {
        const { source, query, params = {} } = req.body;
        if (!source || !query) {
            return res.status(400).json({
                success: false,
                error: 'Bitte "source" und "query" im Body angeben'
            });
        }

        try {
            const repo = repositoryFactory.getRepository(
                /* label irrelevant hier */ null,
                source
            );
            // Nutze executeQuery (Memgraph) oder execute (Oracle) je nach Quelle
            let result;
            if (source === 'memgraph') {
                result = await repo.executeQuery(query);
            } else if (source === 'oracle') {
                // execute erwartet ein Objekt mit key=source, value=query
                const queries = { oracle: query };
                result = await repo.execute(queries, params);
            } else {
                throw new Error(`Unbekannte Quelle: ${source}`);
            }

            res.json({ success: true, source, result });
        } catch (error) {
            console.error('Fehler bei direkter Query:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // 🎯 POST /api/query/structured - NEUE Strukturierte Abfragen vom QueryBuilder
    router.post('/structured', async (req, res) => {
        try {
            const {
                queryType,           // 'find_related', 'find_path', 'count_relations'
                entityType,          // 'person', 'award', etc.
                entityName,          // 'Alan Turing'
                relationshipType,    // 'worked_in', 'received', etc.
                targetEntityType,    // 'field', 'award', etc.
                database = 'both'    // 'oracle', 'memgraph', 'both'
            } = req.body;

            console.log(`🔍 Structured Query: ${queryType} | ${entityType}:${entityName} -[${relationshipType}]-> ${targetEntityType} | DB: ${database}`);

            // Validierung
            if (!queryType || !entityType || !entityName) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required fields: queryType, entityType, entityName'
                });
            }

            let results = {};

            // Je nach Database-Parameter unterschiedlich abfragen
            if (database === 'both') {
                // Beide Datenbanken abfragen
                try {
                    results.oracle = await executeStructuredQuery('oracle', queryType, entityType, entityName, relationshipType, targetEntityType, repositoryFactory);
                } catch (err) {
                    console.warn('Oracle query failed:', err.message);
                    results.oracle = { error: err.message, data: [] };
                }

                try {
                    results.memgraph = await executeStructuredQuery('memgraph', queryType, entityType, entityName, relationshipType, targetEntityType, repositoryFactory);
                } catch (err) {
                    console.warn('Memgraph query failed:', err.message);
                    results.memgraph = { error: err.message, data: [] };
                }
            } else {
                // Einzelne Datenbank
                results[database] = await executeStructuredQuery(database, queryType, entityType, entityName, relationshipType, targetEntityType, repositoryFactory);
            }

            res.json({
                success: true,
                query: {
                    type: queryType,
                    entity: `${entityType}:${entityName}`,
                    relationship: relationshipType,
                    target: targetEntityType,
                    database
                },
                results,
                generatedQueries: {
                    oracle: generateOracleQuery(queryType, entityType, entityName, relationshipType, targetEntityType),
                    memgraph: generateMemgraphQuery(queryType, entityType, entityName, relationshipType, targetEntityType)
                },
                metadata: {
                    timestamp: new Date().toISOString(),
                    executedOn: database
                }
            });

        } catch (error) {
            console.error('Structured query error:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });

    // 🎯 GET /api/query/entities/search - Entity-Namen für Autocomplete
    router.get('/entities/search', async (req, res) => {
        try {
            const { type: entityType, q: searchTerm, db = 'memgraph', limit = 10 } = req.query;

            if (!entityType || !searchTerm) {
                return res.status(400).json({
                    success: false,
                    error: 'entityType and searchTerm (q) are required'
                });
            }

            const repo = repositoryFactory.getRepository(entityType, db);
            const results = await repo.searchByName(searchTerm, parseInt(limit));

            // Nur Namen für Autocomplete extrahieren
            const names = results.map(entity => {
                if (db === 'oracle') {
                    return entity.NAME || entity.name;
                } else {
                    return entity['e.name'] || entity.name;
                }
            }).filter(name => name);

            res.json({
                success: true,
                data: {
                    suggestions: names,
                    metadata: {
                        entityType,
                        searchTerm,
                        database: db,
                        count: names.length
                    }
                }
            });

        } catch (error) {
            console.error('Entity search error:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });

    return router;
};

// 🎯 HELPER: Strukturierte Query ausführen
async function executeStructuredQuery(database, queryType, entityType, entityName, relationshipType, targetEntityType, repositoryFactory) {

    if (queryType === 'find_related') {
        // 1. Zuerst die Entity anhand des Namens finden
        const entityRepo = repositoryFactory.getRepository(entityType, database);
        const entities = await entityRepo.searchByName(entityName, 5);

        if (!entities || entities.length === 0) {
            throw new Error(`Entity "${entityName}" not found in ${database}`);
        }

        // Erste gefundene Entity verwenden
        const entity = entities[0];
        let wikidataId;

        // Wikidata ID extrahieren (je nach Database unterschiedlich)
        if (database === 'oracle') {
            // Oracle: PERSONS(Q7251) → Q7251
            const match = entity.VERTEX_ID?.match(/\(([^)]+)\)/);
            wikidataId = match ? match[1] : null;
            if (!wikidataId && entity.ID) {
                wikidataId = entity.ID;
            }
        } else {
            // Memgraph: direkt aus e.id
            wikidataId = entity['e.id'] || entity.id;
        }

        if (!wikidataId) {
            throw new Error(`Could not extract Wikidata ID for "${entityName}" in ${database}`);
        }

        console.log(`📍 Found entity: ${entityName} → ${wikidataId} in ${database}`);

        // 2. Relationships abrufen
        if (relationshipType) {
            // Spezifische Beziehung
            const relationships = await entityRepo.getSpecificRelationships(wikidataId, relationshipType.toUpperCase(), 'outgoing');

            // Nach Ziel-Entity-Typ filtern (falls angegeben)
            let filteredResults = relationships;
            if (targetEntityType) {
                filteredResults = relationships.filter(rel => {
                    if (database === 'oracle') {
                       // return rel.TARGET_VERTEX_ID && rel.TARGET_VERTEX_ID.toUpperCase().includes(targetEntityType.toUpperCase());
                        return rel.TARGET_VERTEX_ID && rel.TARGET_VERTEX_ID.toLowerCase().includes(targetEntityType.toLowerCase());
                    } else {
                        return rel.target_labels && rel.target_labels.some(label =>
                            label.toLowerCase() === targetEntityType.toLowerCase()
                        );
                    }
                });
            }

            return {
                sourceEntity: entity,
                relationships: filteredResults,
                count: filteredResults.length,
                queryInfo: {
                    wikidataId,
                    relationshipType: relationshipType.toUpperCase(),
                    targetEntityType
                }
            };
        } else {
            // Alle Beziehungen
            const relationships = await entityRepo.getRelationships(wikidataId);
            return {
                sourceEntity: entity,
                relationships,
                count: relationships.length,
                queryInfo: { wikidataId }
            };
        }
    }

    // Weitere Query-Typen hier implementieren...
    throw new Error(`Query type "${queryType}" not implemented yet`);
}

// 🎯 HELPER: Oracle Query generieren (für Frontend-Display)
function generateOracleQuery(queryType, entityType, entityName, relationshipType, targetEntityType) {
    if (queryType === 'find_related') {
        const oracleEntityType = entityType.toUpperCase();
        const oracleRelType = relationshipType ? relationshipType.toUpperCase() : '';
        const oracleTargetType = targetEntityType ? targetEntityType.toUpperCase() : '';

        if (relationshipType && targetEntityType) {
            return `SELECT t.name, t.id
FROM MATCH (p:${oracleEntityType})-[:${oracleRelType}]->(t:${oracleTargetType}) ON ALL_GRAPH
WHERE p.name = '${entityName}'`;
        } else {
            return `SELECT label(r) as relationship_type, t.name, t.id
FROM MATCH (p:${oracleEntityType})-[r]->(t) ON ALL_GRAPH  
WHERE p.name = '${entityName}'`;
        }
    }
    return '';
}

// 🎯 HELPER: Memgraph Query generieren (für Frontend-Display)
function generateMemgraphQuery(queryType, entityType, entityName, relationshipType, targetEntityType) {
    if (queryType === 'find_related') {
        const memgraphEntityType = entityType.toLowerCase();
        const memgraphRelType = relationshipType ? relationshipType.toUpperCase() : '';
        const memgraphTargetType = targetEntityType ? targetEntityType.toLowerCase() : '';

        if (relationshipType && targetEntityType) {
            return `MATCH (p:${memgraphEntityType})-[:${memgraphRelType}]->(t:${memgraphTargetType})
WHERE p.name = '${entityName}'
RETURN t.name, t.id`;
        } else {
            return `MATCH (p:${memgraphEntityType})-[r]->(t)
WHERE p.name = '${entityName}'
RETURN type(r) as relationship_type, t.name, t.id`;
        }
    }
    return '';
}