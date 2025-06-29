// src/routes/query.js - COMPLETE FIXED VERSION with Working Path Finding
const express = require('express');
const router = express.Router();

module.exports = repositoryFactory => {

    // 🎯 POST /api/query - Raw Query Execution
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

    // 🎯 POST /api/query/structured - FIXED Path Finding
    router.post('/structured', async (req, res) => {
        try {
            const {
                queryType,           // 'find_related', 'find_path', 'count_relations'
                entityType,          // 'person', 'award', etc.
                entityName,          // 'Alan Turing'
                relationshipType,    // 'worked_in', 'received', etc.
                targetEntityType,    // 'field', 'award', etc.
                targetEntityName,    // Für find_path: Ziel-Entity Name
                database = 'both'    // 'oracle', 'memgraph', 'both'
            } = req.body;

            console.log(`🔍 Structured Query: ${queryType} | ${entityType}:${entityName} ${queryType === 'find_path' ? `-> ${targetEntityType}:${targetEntityName}` : `-[${relationshipType}]-> ${targetEntityType}`} | DB: ${database}`);

            // Validierung
            if (!queryType || !entityType || !entityName) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required fields: queryType, entityType, entityName'
                });
            }

            // Zusätzliche Validierung für find_path
            if (queryType === 'find_path' && (!targetEntityType || !targetEntityName)) {
                return res.status(400).json({
                    success: false,
                    error: 'find_path requires targetEntityType and targetEntityName'
                });
            }

            let results = {};

            // Je nach Database-Parameter unterschiedlich abfragen
            if (database === 'both') {
                // Beide Datenbanken abfragen
                try {
                    results.oracle = await executeStructuredQuery('oracle', queryType, entityType, entityName, relationshipType, targetEntityType, repositoryFactory, targetEntityName);
                } catch (err) {
                    console.warn('Oracle query failed:', err.message);
                    results.oracle = { error: err.message, data: [] };
                }

                try {
                    results.memgraph = await executeStructuredQuery('memgraph', queryType, entityType, entityName, relationshipType, targetEntityType, repositoryFactory, targetEntityName);
                } catch (err) {
                    console.warn('Memgraph query failed:', err.message);
                    results.memgraph = { error: err.message, data: [] };
                }
            } else {
                // Einzelne Datenbank
                results[database] = await executeStructuredQuery(database, queryType, entityType, entityName, relationshipType, targetEntityType, repositoryFactory, targetEntityName);
            }

            res.json({
                success: true,
                query: {
                    type: queryType,
                    entity: `${entityType}:${entityName}`,
                    relationship: relationshipType,
                    target: queryType === 'find_path' ? `${targetEntityType}:${targetEntityName}` : targetEntityType,
                    database
                },
                results,
                generatedQueries: {
                    oracle: generateOracleQuery(queryType, entityType, entityName, relationshipType, targetEntityType, targetEntityName),
                    memgraph: generateMemgraphQuery(queryType, entityType, entityName, relationshipType, targetEntityType, targetEntityName)
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

// 🔧 COMPLETELY FIXED: Strukturierte Query ausführen
async function executeStructuredQuery(database, queryType, entityType, entityName, relationshipType, targetEntityType, repositoryFactory, targetEntityName = null) {

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

        // 🔧 FIXED: Bessere Wikidata ID Extraktion
        if (database === 'oracle') {
            // Oracle: vertex_id oder VERTEX_ID
            const vertexId = entity.vertex_id || entity.VERTEX_ID;
            if (vertexId) {
                const match = vertexId.match(/\(([^)]+)\)/);
                wikidataId = match ? match[1] : null;
            }
            // Fallback: direkte id property
            if (!wikidataId) {
                wikidataId = entity.id || entity.ID;
            }
        } else {
            // Memgraph: e.id oder id
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
                        // Oracle hat FIELDS(Q123) in TARGET_VERTEX_ID 
                        return rel.TARGET_VERTEX_ID && rel.TARGET_VERTEX_ID.toUpperCase().includes(targetEntityType.toUpperCase());
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

    // 🔧 COMPLETELY REWRITTEN: find_path mit echtem Shortest Path
    if (queryType === 'find_path') {
        console.log(`🛤️ Finding path: ${entityName} (${entityType}) → ${targetEntityName} (${targetEntityType}) in ${database}`);

        // 1. Start-Entity finden
        const startRepo = repositoryFactory.getRepository(entityType, database);
        const startEntities = await startRepo.searchByName(entityName, 5);

        if (!startEntities || startEntities.length === 0) {
            throw new Error(`Start entity "${entityName}" not found in ${database}`);
        }

        // 2. Ziel-Entity finden
        const targetRepo = repositoryFactory.getRepository(targetEntityType, database);
        const targetEntities = await targetRepo.searchByName(targetEntityName, 5);

        if (!targetEntities || targetEntities.length === 0) {
            throw new Error(`Target entity "${targetEntityName}" not found in ${database}`);
        }

        const startEntity = startEntities[0];
        const targetEntity = targetEntities[0];

        // 🔧 FIXED: Bessere Wikidata ID Extraktion
        let startId, targetId;

        if (database === 'oracle') {
            // Oracle: vertex_id extrahieren
            const startVertexId = startEntity.vertex_id || startEntity.VERTEX_ID;
            const targetVertexId = targetEntity.vertex_id || targetEntity.VERTEX_ID;

            if (startVertexId) {
                const startMatch = startVertexId.match(/\(([^)]+)\)/);
                startId = startMatch ? startMatch[1] : null;
            }
            if (targetVertexId) {
                const targetMatch = targetVertexId.match(/\(([^)]+)\)/);
                targetId = targetMatch ? targetMatch[1] : null;
            }

            // Fallback
            if (!startId) startId = startEntity.id || startEntity.ID;
            if (!targetId) targetId = targetEntity.id || targetEntity.ID;
        } else {
            // Memgraph
            startId = startEntity['e.id'] || startEntity.id;
            targetId = targetEntity['e.id'] || targetEntity.id;
        }

        if (!startId || !targetId) {
            throw new Error(`Could not extract Wikidata IDs for path finding in ${database}. Start: ${startId}, Target: ${targetId}`);
        }

        console.log(`🛤️ Path IDs: ${startId} → ${targetId}`);

        // 3. ✅ FIXED: Echte Pfad-Suche
        try {
            const pathResult = await findShortestPath(startRepo, startId, targetId, database, entityType, targetEntityType, entityName, targetEntityName);

            return {
                startEntity,
                targetEntity,
                paths: pathResult.paths,
                pathsFound: pathResult.pathsFound,
                queryInfo: {
                    startId,
                    targetId,
                    pathType: pathResult.pathType,
                    message: pathResult.message
                }
            };
        } catch (pathError) {
            console.error('Path finding error:', pathError);
            return {
                startEntity,
                targetEntity,
                paths: [],
                pathsFound: 0,
                error: pathError.message,
                queryInfo: {
                    startId,
                    targetId,
                    pathType: 'error'
                }
            };
        }
    }

    // Weitere Query-Typen hier implementieren...
    throw new Error(`Query type "${queryType}" not implemented yet`);
}

// 🔧 COMPLETELY REWRITTEN: Shortest Path Search
async function findShortestPath(repo, startId, targetId, database, startEntityType, targetEntityType, startEntityName, targetEntityName) {
    try {
        console.log(`🛤️ Finding shortest path between ${startId} and ${targetId} in ${database}`);

        if (database === 'oracle') {
            return await findShortestPathOracle(startId, targetId, startEntityType, targetEntityType, startEntityName, targetEntityName, repo);
        } else {
            return await findShortestPathMemgraph(startId, targetId, startEntityType, targetEntityType, startEntityName, targetEntityName, repo);
        }
    } catch (error) {
        console.error('Shortest path search error:', error);
        return {
            paths: [],
            pathsFound: 0,
            pathType: 'error',
            message: `Error finding path: ${error.message}`
        };
    }
}

// 🔧 ORACLE Shortest Path Implementation
async function findShortestPathOracle(startId, targetId, startEntityType, targetEntityType, startEntityName, targetEntityName, repo) {
    try {
        const startLabel = getOracleLabelFromEntityType(startEntityType);
        const targetLabel = getOracleLabelFromEntityType(targetEntityType);

        console.log(`🔍 Oracle path query: ${startLabel}:${startEntityName} → ${targetLabel}:${targetEntityName}`);

        // ✅ FIXED: Einfachere Oracle PGQL Query - sucht nach Namen statt Vertex IDs
        const shortestPathQuery = `
            SELECT path_length(path) as path_length,
                   vertices(path) as path_vertices,
                   edges(path) as path_edges
            FROM MATCH SHORTEST (start:${startLabel})-[:*1..4]->(end:${targetLabel}) ONE ROW PER STEP (start, end) ON ALL_GRAPH
            WHERE start.name = '${startEntityName}' AND end.name = '${targetEntityName}'
        `;

        console.log(`🔍 Oracle shortest path query:`, shortestPathQuery);

        const result = await repo.execute({
            oracle: shortestPathQuery
        });

        console.log(`🔍 Oracle path result:`, result);

        if (result && result.length > 0) {
            const pathData = result[0];
            return {
                paths: [{
                    vertices: pathData.path_vertices || [],
                    edges: pathData.path_edges || [],
                    length: pathData.path_length || 0,
                    pathType: 'shortest'
                }],
                pathsFound: 1,
                pathType: 'shortest_path_found',
                message: `Shortest path found with length ${pathData.path_length || 0}`
            };
        } else {
            // ✅ FIXED: Fallback - prüfe ob überhaupt eine Verbindung existiert
            const anyPathQuery = `
                SELECT COUNT(*) as path_count
                FROM MATCH (start:${startLabel})-[:*1..3]->(end:${targetLabel}) ON ALL_GRAPH
                WHERE start.name = '${startEntityName}' AND end.name = '${targetEntityName}'
            `;

            console.log(`🔍 Oracle fallback query:`, anyPathQuery);

            const anyPathResult = await repo.execute({
                oracle: anyPathQuery
            });

            console.log(`🔍 Oracle fallback result:`, anyPathResult);

            if (anyPathResult && anyPathResult[0]?.path_count > 0) {
                return {
                    paths: [],
                    pathsFound: 0,
                    pathType: 'path_exists_but_details_failed',
                    message: `Path exists (${anyPathResult[0].path_count} found) but couldn't retrieve details. Oracle PGQL limitation.`
                };
            }

            return {
                paths: [],
                pathsFound: 0,
                pathType: 'no_path',
                message: `No path found between ${startEntityName} and ${targetEntityName} (checked up to 3 hops)`
            };
        }
    } catch (error) {
        console.error('Oracle path finding error:', error);
        throw error;
    }
}

// 🔧 MEMGRAPH Shortest Path Implementation  
async function findShortestPathMemgraph(startId, targetId, startEntityType, targetEntityType, startEntityName, targetEntityName, repo) {
    try {
        const startLabel = startEntityType.toLowerCase();
        const targetLabel = targetEntityType.toLowerCase();

        console.log(`🔍 Memgraph path query: ${startLabel}:${startEntityName} → ${targetLabel}:${targetEntityName}`);

        // ✅ FIXED: Memgraph shortestPath query mit Namen
        const shortestPathQuery = `
            MATCH path = shortestPath((start:${startLabel} {name: '${startEntityName}'})-[*..4]-(end:${targetLabel} {name: '${targetEntityName}'}))
            RETURN 
                nodes(path) as path_nodes,
                relationships(path) as path_relationships,
                length(path) as path_length
        `;

        console.log(`🔍 Memgraph shortest path query:`, shortestPathQuery);

        const result = await repo.execute({
            memgraph: shortestPathQuery
        });

        console.log(`🔍 Memgraph path result:`, result);

        if (result && result.length > 0) {
            const pathData = result[0];

            // Extract path information
            const pathNodes = pathData.path_nodes || [];
            const pathRels = pathData.path_relationships || [];

            return {
                paths: [{
                    nodes: pathNodes.map(node => ({
                        id: node.properties?.id || 'unknown',
                        name: node.properties?.name || 'unknown',
                        labels: node.labels || []
                    })),
                    relationships: pathRels.map(rel => ({
                        type: rel.type || 'unknown',
                        properties: rel.properties || {}
                    })),
                    length: pathData.path_length || 0,
                    pathType: 'shortest'
                }],
                pathsFound: 1,
                pathType: 'shortest_path_found',
                message: `Shortest path found with length ${pathData.path_length || 0}`
            };
        } else {
            // ✅ FIXED: Fallback - prüfe ob irgendein Pfad existiert
            const anyPathQuery = `
                MATCH (start:${startLabel} {name: '${startEntityName}'})-[*1..4]-(end:${targetLabel} {name: '${targetEntityName}'})
                RETURN count(*) as path_count
            `;

            console.log(`🔍 Memgraph fallback query:`, anyPathQuery);

            const anyPathResult = await repo.execute({
                memgraph: anyPathQuery
            });

            console.log(`🔍 Memgraph fallback result:`, anyPathResult);

            if (anyPathResult && anyPathResult[0]?.path_count > 0) {
                return {
                    paths: [],
                    pathsFound: 0,
                    pathType: 'path_exists_but_shortest_failed',
                    message: `Path exists (${anyPathResult[0].path_count} found) but shortestPath algorithm failed. Try different entities.`
                };
            }

            return {
                paths: [],
                pathsFound: 0,
                pathType: 'no_path',
                message: `No path found between ${startEntityName} and ${targetEntityName} (checked up to 4 hops)`
            };
        }
    } catch (error) {
        console.error('Memgraph path finding error:', error);
        throw error;
    }
}

// 🎯 HELPER: Oracle Label von Entity Type
function getOracleLabelFromEntityType(entityType) {
    const labelMap = {
        'person': 'PERSON',
        'award': 'AWARD',
        'field': 'FIELD',
        'place': 'PLACE',
        'work': 'WORK',
        'workplace': 'WORKPLACE',
        'occupation': 'OCCUPATION'
    };
    return labelMap[entityType] || entityType.toUpperCase();
}

// 🔧 UPDATED: Query Generator für find_path
function generateOracleQuery(queryType, entityType, entityName, relationshipType, targetEntityType, targetEntityName) {
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

    if (queryType === 'find_path') {
        const oracleStartType = getOracleLabelFromEntityType(entityType);
        const oracleTargetType = getOracleLabelFromEntityType(targetEntityType);

        return `SELECT path_length(path) as path_length,
       vertices(path) as path_vertices,
       edges(path) as path_edges
FROM MATCH SHORTEST (start:${oracleStartType})-[:*1..4]->(end:${oracleTargetType}) ONE ROW PER STEP (start, end) ON ALL_GRAPH
WHERE start.name = '${entityName}' AND end.name = '${targetEntityName}'`;
    }

    return '';
}

function generateMemgraphQuery(queryType, entityType, entityName, relationshipType, targetEntityType, targetEntityName) {
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

    if (queryType === 'find_path') {
        const memgraphStartType = entityType.toLowerCase();
        const memgraphTargetType = targetEntityType.toLowerCase();

        return `MATCH path = shortestPath((start:${memgraphStartType} {name: '${entityName}'})-[*..4]-(end:${memgraphTargetType} {name: '${targetEntityName}'}))
RETURN 
    nodes(path) as path_nodes,
    relationships(path) as path_relationships,
    length(path) as path_length`;
    }

    return '';
}