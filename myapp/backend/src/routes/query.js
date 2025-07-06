// src/routes/query.js - COMPLETE FIXED VERSION with Working Path Finding
const express = require('express');
const router = express.Router();

module.exports = repositoryFactory => {

    // 🎯 POST /api/query - Raw Query Execution
    router.post('/', async (req, res) => {
        const {source, query, params = {}} = req.body;
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
                const queries = {oracle: query};
                result = await repo.execute(queries, params);
            } else {
                throw new Error(`Unbekannte Quelle: ${source}`);
            }

            res.json({success: true, source, result});
        } catch (error) {
            console.error('Fehler bei direkter Query:', error);
            res.status(500).json({success: false, error: error.message});
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
                    results.oracle = {error: err.message, data: []};
                }

                try {
                    results.memgraph = await executeStructuredQuery('memgraph', queryType, entityType, entityName, relationshipType, targetEntityType, repositoryFactory, targetEntityName);
                } catch (err) {
                    console.warn('Memgraph query failed:', err.message);
                    results.memgraph = {error: err.message, data: []};
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
            const {type: entityType, q: searchTerm, db = 'memgraph', limit = 10} = req.query;

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
                queryInfo: {wikidataId}
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

        // 3. ✅ FIXED: Echte Pfad-Suche nach Database
        try {
            let pathResult;

            if (database === 'oracle') {
                pathResult = await findShortestPathOracle(startId, targetId, entityType, targetEntityType, entityName, targetEntityName, startRepo);
            } else if (database === 'memgraph') {
                pathResult = await findShortestPathMemgraph(startId, targetId, entityType, targetEntityType, entityName, targetEntityName, startRepo);
            } else {
                throw new Error(`Unknown database: ${database}`);
            }

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

    if (queryType === 'find_incoming') {
        // 1. Zuerst die Entity anhand des Namens finden
        const entityRepo = repositoryFactory.getRepository(entityType, database);
        const entities = await entityRepo.searchByName(entityName, 5);

        if (!entities || entities.length === 0) {
            throw new Error(`Entity "${entityName}" not found in ${database}`);
        }

        // Erste gefundene Entity verwenden
        const entity = entities[0];
        let wikidataId;

        // Wikidata ID Extraktion (gleich wie bei find_related)
        if (database === 'oracle') {
            const vertexId = entity.vertex_id || entity.VERTEX_ID;
            if (vertexId) {
                const match = vertexId.match(/\(([^)]+)\)/);
                wikidataId = match ? match[1] : null;
            }
            if (!wikidataId) {
                wikidataId = entity.id || entity.ID;
            }
        } else {
            wikidataId = entity['e.id'] || entity.id;
        }

        if (!wikidataId) {
            throw new Error(`Could not extract Wikidata ID for "${entityName}" in ${database}`);
        }

        console.log(`📍 Found entity for incoming search: ${entityName} → ${wikidataId} in ${database}`);

        // 2. Incoming Relationships abrufen
        let relationships;
        if (relationshipType) {
            // Spezifische incoming Beziehung
            relationships = await entityRepo.getSpecificIncomingRelationships(wikidataId, relationshipType.toUpperCase());
        } else {
            // Alle incoming Beziehungen
            relationships = await entityRepo.getIncomingRelationships(wikidataId);
        }

        return {
            sourceEntity: entity,
            relationships,
            count: relationships.length,
            queryInfo: {
                wikidataId,
                direction: 'incoming',
                relationshipType: relationshipType ? relationshipType.toUpperCase() : 'all',
                targetEntityType
            }
        };
    }

    // In executeStructuredQuery function, nach find_incoming:
    if (queryType === 'find_connected_persons') {
        // 1. Entity finden
        const entityRepo = repositoryFactory.getRepository(entityType, database);
        const entities = await entityRepo.searchByName(entityName, 5);

        if (!entities || entities.length === 0) {
            throw new Error(`Entity "${entityName}" not found in ${database}`);
        }

        const entity = entities[0];
        let wikidataId;

        // Wikidata ID extrahieren (wie bei anderen Query-Types)
        if (database === 'oracle') {
            const vertexId = entity.vertex_id || entity.VERTEX_ID;
            if (vertexId) {
                const match = vertexId.match(/\(([^)]+)\)/);
                wikidataId = match ? match[1] : null;
            }
            if (!wikidataId) {
                wikidataId = entity.id || entity.ID;
            }
        } else {
            wikidataId = entity['e.id'] || entity.id;
        }

        if (!wikidataId) {
            throw new Error(`Could not extract Wikidata ID for "${entityName}" in ${database}`);
        }

        console.log(`📍 Found entity: ${entityName} → ${wikidataId} in ${database}`);

        // 2. Connected persons finden
        const connectedPersons = await entityRepo.findConnectedPersons(wikidataId);

        return {
            sourceEntity: entity,
            relationships: connectedPersons,
            count: connectedPersons.length,
            queryInfo: {
                wikidataId,
                method: 'find_connected_persons',
                direction: 'incoming_persons_only'
            }
        };
    }

    // Weitere Query-Typen hier implementieren...
    throw new Error(`Query type "${queryType}" not implemented yet`);
}

// 🔧 COMPLETELY REWRITTEN: Shortest Path Search
async function findShortestPath(startId, targetId, startEntityType, targetEntityType, startEntityName, targetEntityName, repo) {
    try {
        const result = await findShortestPathOracle(startId, targetId, startEntityType, targetEntityType, startEntityName, targetEntityName, repo);

        // ✅ Korrigierte Response-Struktur
        return {
            success: true,
            pathsFound: result.pathsFound || (result.paths && result.paths.length > 0 ? result.paths.length : 0),
            paths: result.paths || [],
            message: result.message || 'Path search completed',
            database: 'oracle',
            queryType: 'shortest_path',
            // Zusätzliche Metadaten für bessere Anzeige
            metadata: {
                startEntity: startEntityName,
                targetEntity: targetEntityName,
                startEntityType: startEntityType,
                targetEntityType: targetEntityType,
                pathType: result.pathType || 'unknown'
            }
        };
    } catch (error) {
        console.error('Oracle path finding failed:', error);
        return {
            success: false,
            pathsFound: 0,
            paths: [],
            error: error.message,
            database: 'oracle'
        };
    }
}

async function findShortestPathOracle(startId, targetId, startEntityType, targetEntityType, startEntityName, targetEntityName, repo) {
    try {
        const startLabel = getOracleLabelFromEntityType(startEntityType);
        const targetLabel = getOracleLabelFromEntityType(targetEntityType);

        console.log(`🔍 Oracle PGQL path query: ${startLabel}:${startEntityName} → ${targetLabel}:${targetEntityName}`);

        // ✅ KORREKTE PGQL SYNTAX basierend auf funktionierendem Beispiel
        const shortestPathQuery = `
            SELECT start_name, end_name, path_length
            FROM GRAPH_TABLE(ALL_GRAPH
                MATCH (start IS ${startLabel}) -[e]-* (end IS ${targetLabel})
                KEEP ANY SHORTEST
                WHERE start.name = '${startEntityName}'
                AND end.name = '${targetEntityName}'
                COLUMNS(start.name AS start_name,
                end.name AS end_name,
                COUNT (EDGE_ID(e)) AS path_length))
        `;

        console.log(`🔍 Oracle PGQL query:`, shortestPathQuery);

        const result = await repo.execute({
            oracle: shortestPathQuery
        });

        console.log(`🔍 Oracle path result:`, result);

        if (result && result.length > 0) {
            const pathData = result[0];
            return {
                paths: [{
                    length: pathData.path_length || pathData.PATH_LENGTH || 0,
                    pathType: 'shortest_oracle',
                    startName: pathData.start_name || pathData.START_NAME,
                    endName: pathData.end_name || pathData.END_NAME
                }],
                pathsFound: 1,
                pathType: 'shortest_path_found',
                message: `Oracle shortest path found with length ${pathData.path_length || pathData.PATH_LENGTH || 0}`
            };
        } else {
            // ✅ Fallback: Alternative PGQL Syntax ohne GRAPH_TABLE
            const fallbackQuery = `
                SELECT COUNT(e) as path_length
                FROM MATCH ANY SHORTEST (start IS ${startLabel}) -[e]->+ (end IS ${targetLabel})
                ON ALL_GRAPH
                WHERE
                start.name = '${startEntityName}' AND
                end
                .name = '${targetEntityName}'
            `;

            console.log(`🔍 Oracle fallback query:`, fallbackQuery);

            const connectionResult = await repo.execute({
                oracle: fallbackQuery
            });

            console.log(`🔍 Oracle fallback result:`, connectionResult);

            if (connectionResult && connectionResult[0]?.path_length > 0) {
                return {
                    paths: [{
                        length: connectionResult[0].path_length,
                        pathType: 'shortest_path_fallback'
                    }],
                    pathsFound: 1,
                    pathType: 'shortest_path_found_fallback',
                    message: `Shortest path found via fallback with length ${connectionResult[0].path_length}`
                };
            }

            return {
                paths: [],
                pathsFound: 0,
                pathType: 'no_path',
                message: `No path found between ${startEntityName} and ${targetEntityName}`
            };
        }
    } catch (error) {
        console.error('Oracle PGQL path finding error:', error);

        // 🚀 LETZTER FALLBACK: Einfacher Verbindungstest
        try {
            console.log(`🔄 Oracle final fallback: simple connection test...`);

            // Alternative Syntax für direkten Verbindungstest
            const simpleConnectionQuery = `
                SELECT src.name as start_name, dst.name as end_name
                FROM MATCH(src IS ${getOracleLabelFromEntityType(startEntityType)}) -[]-> (dst IS ${getOracleLabelFromEntityType(targetEntityType)})
                ON ALL_GRAPH
                WHERE src.name = '${startEntityName}'
                  AND dst.name = '${targetEntityName}'
                    FETCH FIRST 1 ROWS ONLY
            `;

            const simpleResult = await repo.execute({
                oracle: simpleConnectionQuery
            });

            if (simpleResult && simpleResult.length > 0) {
                return {
                    paths: [{
                        length: 1,
                        pathType: 'direct_connection_fallback'
                    }],
                    pathsFound: 1,
                    pathType: 'direct_connection_found',
                    message: `Direct connection found (Oracle shortest path failed)`
                };
            }

            // Letzter Versuch mit einfachster Syntax
            const basicQuery = `
                SELECT start.name, end.name
                FROM MATCH(start) -> (end)
                ON ALL_GRAPH
                WHERE
                start.name = '${startEntityName}'
                  AND
                end
                .name = '${targetEntityName}'
                  AND start IS LABELED
                ${getOracleLabelFromEntityType(startEntityType)}
                AND
                end
                IS LABELED
                ${getOracleLabelFromEntityType(targetEntityType)}
                FETCH
                FIRST
                1
                ROWS
                ONLY
            `;

            const basicResult = await repo.execute({
                oracle: basicQuery
            });

            if (basicResult && basicResult.length > 0) {
                return {
                    paths: [{
                        length: 1,
                        pathType: 'basic_connection'
                    }],
                    pathsFound: 1,
                    pathType: 'basic_connection_found',
                    message: `Basic connection found via alternative syntax`
                };
            }

            return {
                paths: [],
                pathsFound: 0,
                pathType: 'oracle_shortest_path_not_supported',
                message: `Oracle PGQL path finding not fully supported with current schema. Found no connection.`
            };

        } catch (fallbackError) {
            console.error('Oracle final fallback also failed:', fallbackError);

            return {
                paths: [],
                pathsFound: 0,
                pathType: 'oracle_error',
                message: `Oracle path finding failed: ${error.message}`
            };
        }
    }
}


// 🔧 KOMPLETTE Memgraph PathFinding Funktion
async function findShortestPathMemgraph(startId, targetId, startEntityType, targetEntityType, startEntityName, targetEntityName, repo) {
    try {
        console.log(`🛤️ Finding path: ${startEntityName} (${startEntityType}) → ${targetEntityName} (${targetEntityType}) in memgraph`);

        const startLabel = getMemgraphLabelFromEntityType(startEntityType);
        const targetLabel = getMemgraphLabelFromEntityType(targetEntityType);

        console.log(`🔍 Memgraph BFS path query: ${startLabel}:${startEntityName} → ${targetLabel}:${targetEntityName}`);

        // ✅ Memgraph BFS Query für Shortest Path
        const bfsQuery = `
            MATCH path = (start:${startLabel} {name: '${startEntityName}'})-[*1..4]-(end:${targetLabel} {name: '${targetEntityName}'})
            RETURN
                nodes(path) as path_nodes,
                relationships(path) as path_relationships,
                length(path) as path_length
            ORDER BY length(path) ASC
            LIMIT 1
        `;

        console.log(`🔍 Memgraph BFS query:\n${bfsQuery}`);

        const result = await repo.execute({
            memgraph: bfsQuery
        });

        console.log(`🔍 Memgraph path result:`, result);

        if (result && result.length > 0) {
            const pathData = result[0];
            const pathNodes = pathData.path_nodes || [];
            const pathRelationships = pathData.path_relationships || [];

            // ✅ Bessere Pfad-Struktur für Frontend
            const formattedPath = {
                length: pathData.path_length || 0,
                nodes: pathNodes.map((node, index) => ({
                    id: node.properties?.id || node.properties?.name || `node_${index}`,
                    name: node.properties?.name || `Node ${index + 1}`,
                    type: node.labels?.[0] || startEntityType,
                    properties: node.properties || {},
                    memgraphId: node.id || null
                })),
                relationships: pathRelationships.map((rel, index) => ({
                    id: rel.id || `rel_${index}`,
                    type: rel.type || 'CONNECTED_TO',
                    properties: rel.properties || {},
                    startNode: rel.startNode || null,
                    endNode: rel.endNode || null
                })),
                pathType: 'shortest_memgraph',
                database: 'memgraph'
            };

            console.log(`✅ Formatted path:`, formattedPath);

            return {
                success: true,
                pathsFound: 1,
                paths: [formattedPath],
                message: `Shortest path found with length ${pathData.path_length}`,
                database: 'memgraph',
                queryType: 'shortest_path',
                metadata: {
                    startEntity: startEntityName,
                    targetEntity: targetEntityName,
                    startEntityType: startEntityType,
                    targetEntityType: targetEntityType,
                    algorithm: 'BFS',
                    maxDepth: 4
                }
            };
        } else {
            // ✅ Fallback: Erweiterte Suche ohne Labels
            console.log(`🔄 Memgraph fallback: trying without specific labels...`);

            const fallbackQuery = `
                MATCH path = (start {name: '${startEntityName}'})-[*1..4]-(end {name: '${targetEntityName}'})
                RETURN
                    nodes(path) as path_nodes,
                    relationships(path) as path_relationships,
                    length(path) as path_length
                ORDER BY length(path) ASC
                LIMIT 1
            `;

            console.log(`🔍 Memgraph fallback query:\n${fallbackQuery}`);

            const fallbackResult = await repo.execute({
                memgraph: fallbackQuery
            });

            if (fallbackResult && fallbackResult.length > 0) {
                const pathData = fallbackResult[0];
                const pathNodes = pathData.path_nodes || [];
                const pathRelationships = pathData.path_relationships || [];

                const formattedPath = {
                    length: pathData.path_length || 0,
                    nodes: pathNodes.map((node, index) => ({
                        id: node.properties?.id || node.properties?.name || `node_${index}`,
                        name: node.properties?.name || `Node ${index + 1}`,
                        type: node.labels?.[0] || 'unknown',
                        properties: node.properties || {},
                        memgraphId: node.id || null
                    })),
                    relationships: pathRelationships.map((rel, index) => ({
                        id: rel.id || `rel_${index}`,
                        type: rel.type || 'CONNECTED_TO',
                        properties: rel.properties || {},
                        startNode: rel.startNode || null,
                        endNode: rel.endNode || null
                    })),
                    pathType: 'shortest_memgraph_fallback',
                    database: 'memgraph'
                };

                return {
                    success: true,
                    pathsFound: 1,
                    paths: [formattedPath],
                    message: `Shortest path found with fallback query, length ${pathData.path_length}`,
                    database: 'memgraph',
                    queryType: 'shortest_path',
                    metadata: {
                        startEntity: startEntityName,
                        targetEntity: targetEntityName,
                        startEntityType: startEntityType,
                        targetEntityType: targetEntityType,
                        algorithm: 'BFS_fallback',
                        maxDepth: 4
                    }
                };
            }

            return {
                success: true,
                pathsFound: 0,
                paths: [],
                message: `No path found between ${startEntityName} and ${targetEntityName}`,
                database: 'memgraph',
                queryType: 'shortest_path',
                metadata: {
                    startEntity: startEntityName,
                    targetEntity: targetEntityName,
                    startEntityType: startEntityType,
                    targetEntityType: targetEntityType,
                    algorithm: 'BFS',
                    maxDepth: 4,
                    searchAttempts: ['labeled_search', 'unlabeled_search']
                }
            };
        }

    } catch (error) {
        console.error('Memgraph path finding failed:', error);

        return {
            success: false,
            pathsFound: 0,
            paths: [],
            error: error.message || 'Unknown memgraph pathfinding error',
            database: 'memgraph',
            queryType: 'shortest_path',
            metadata: {
                startEntity: startEntityName,
                targetEntity: targetEntityName,
                startEntityType: startEntityType,
                targetEntityType: targetEntityType,
                errorType: 'memgraph_pathfinding_error'
            }
        };
    }
}

// 🔧 Helper Funktion für Memgraph Labels
function getMemgraphLabelFromEntityType(entityType) {
    return entityType;
}

// 🔧 Hauptfunktion für kombinierte Ergebnisse
async function executePathFindingQuery(queryData, oracleRepo, memgraphRepo) {
    const {entityName, entityType, targetEntityName, targetEntityType, database} = queryData;

    const results = {
        success: true,
        oracle: null,
        memgraph: null,
        summary: {
            totalPathsFound: 0,
            oraclePathsFound: 0,
            memgraphPathsFound: 0
        }
    };

    // Oracle Pathfinding
    if (database === 'oracle' || database === 'both') {
        try {
            const oracleResult = await findShortestPath(
                null, null, entityType, targetEntityType,
                entityName, targetEntityName, oracleRepo
            );

            results.oracle = {
                ...oracleResult,
                database: 'oracle'
            };

            results.summary.oraclePathsFound = oracleResult.pathsFound || 0;

        } catch (error) {
            results.oracle = {
                success: false,
                error: error.message,
                pathsFound: 0,
                paths: [],
                database: 'oracle'
            };
        }
    }

    // Memgraph Pathfinding  
    if (database === 'memgraph' || database === 'both') {
        try {
            const memgraphResult = await findShortestPathMemgraph(
                null, null, entityType, targetEntityType,
                entityName, targetEntityName, memgraphRepo
            );

            results.memgraph = {
                ...memgraphResult,
                database: 'memgraph'
            };

            results.summary.memgraphPathsFound = memgraphResult.pathsFound || 0;

        } catch (error) {
            results.memgraph = {
                success: false,
                error: error.message,
                pathsFound: 0,
                paths: [],
                database: 'memgraph'
            };
        }
    }

    // Gesamtanzahl berechnen
    results.summary.totalPathsFound =
        results.summary.oraclePathsFound + results.summary.memgraphPathsFound;

    return results;
}

// 🔧 PATCH /api/entity/{entityType}/{wikidataId}/properties - Node Property Update
router.patch('/entity/:entityType/:wikidataId/properties', async (req, res) => {
    try {
        const {entityType, wikidataId} = req.params;
        const {property, value} = req.body;
        const {db = 'memgraph'} = req.query;

        console.log(`✏️ UPDATE Request: ${entityType}:${wikidataId} | ${property} = "${value}" | DB: ${db}`);

        // Validierung
        if (!property || !value) {
            return res.status(400).json({
                success: false,
                error: 'Property name and value are required'
            });
        }

        // System-Properties schützen
        const protectedProperties = ['id', 'ID', 'VERTEX_ID', 'vertex_id'];
        if (protectedProperties.includes(property)) {
            return res.status(400).json({
                success: false,
                error: `Property '${property}' is protected and cannot be modified`
            });
        }

        const repo = repositoryFactory.getRepository(entityType, db);

        // 1. Prüfen ob Node existiert
        let existingNode;
        try {
            existingNode = await repo.findByWikidataId(wikidataId);
            if (!existingNode) {
                return res.status(404).json({
                    success: false,
                    error: `Node with ID ${wikidataId} not found in ${db}`
                });
            }
        } catch (findError) {
            console.error('Error finding node for update:', findError);
            return res.status(404).json({
                success: false,
                error: `Node with ID ${wikidataId} not found: ${findError.message}`
            });
        }

        // 2. Aktuellen Wert abrufen
        let currentValue = null;
        if (db === 'oracle') {
            currentValue = existingNode[property] || existingNode[property.toUpperCase()];
        } else {
            currentValue = existingNode[property] || existingNode[`e.${property}`];
        }

        console.log(`📝 Current value for ${property}:`, currentValue);
        console.log(`📝 New value:`, value);

        // 3. Update Query ausführen
        let updateResult;

        if (db === 'memgraph') {
            // Memgraph Cypher UPDATE
            const cypherQuery = `
                    MATCH (n:${entityType} {id: $wikidataId})
                    SET n.${property} = $newValue
                    RETURN n
                `;

            console.log(`🔍 Memgraph UPDATE query:`, cypherQuery);

            updateResult = await repo.executeQuery(cypherQuery, {
                wikidataId,
                newValue: value
            });

        } else if (db === 'oracle') {
            // Oracle PGQL UPDATE
            const pgqlQuery = `
                UPDATE n
                SET (${property} = ?)
                FROM MATCH (n IS ${entityType.toUpperCase()})
                ON ALL_GRAPH
                WHERE n.id = ?
            `;

            console.log(`🔍 Oracle UPDATE query:`, pgqlQuery);

            updateResult = await repo.execute({
                oracle: pgqlQuery
            }, [value, wikidataId]);

        } else {
            throw new Error(`Unsupported database: ${db}`);
        }

        console.log(`✅ Update result:`, updateResult);

        // 4. Aktualisierte Node abrufen für Bestätigung
        let updatedNode;
        try {
            updatedNode = await repo.findByWikidataId(wikidataId);
        } catch (fetchError) {
            console.warn('Could not fetch updated node:', fetchError);
            updatedNode = null;
        }

        // 5. Response
        res.json({
            success: true,
            message: `Property '${property}' updated successfully`,
            data: {
                database: db,
                updatedNode: {
                    entityType,
                    wikidataId,
                    name: updatedNode?.name || updatedNode?.NAME || 'Unknown'
                },
                updatedProperty: {
                    name: property,
                    oldValue: currentValue,
                    newValue: value,
                    changed: currentValue !== value
                },
                nodeData: updatedNode,
                updateQuery: db === 'memgraph' ?
                    `MATCH (n:${entityType} {id: '${wikidataId}'}) SET n.${property} = '${value}' RETURN n` :
                    `UPDATE n
                     SET (${property} = '${value}')
                     FROM MATCH (n IS ${entityType.toUpperCase()})
                     ON ALL_GRAPH
                     WHERE n.id = '${wikidataId}'`
            },
            metadata: {
                timestamp: new Date().toISOString(),
                entityType,
                wikidataId,
                database: db,
                operation: 'UPDATE_PROPERTY'
            }
        });

    } catch (error) {
        console.error('Property update error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            details: {
                operation: 'UPDATE_PROPERTY',
                entityType: req.params.entityType,
                wikidataId: req.params.wikidataId,
                property: req.body.property,
                database: req.query.db || 'memgraph'
            }
        });
    }
});

// 🔧 GET /api/entity/{entityType}/{wikidataId}/properties - Node Properties abrufen
router.get('/entity/:entityType/:wikidataId/properties', async (req, res) => {
    try {
        const {entityType, wikidataId} = req.params;
        const {db = 'memgraph'} = req.query;

        console.log(`📋 GET Properties: ${entityType}:${wikidataId} | DB: ${db}`);

        const repo = repositoryFactory.getRepository(entityType, db);

        // Node abrufen
        const node = await repo.findByWikidataId(wikidataId);

        if (!node) {
            return res.status(404).json({
                success: false,
                error: `Node with ID ${wikidataId} not found in ${db}`
            });
        }

        // Properties extrahieren (System-Properties ausschließen)
        const systemProperties = ['id', 'ID', 'VERTEX_ID', 'vertex_id'];
        const properties = {};

        Object.keys(node).forEach(key => {
            if (!systemProperties.includes(key)) {
                properties[key] = node[key];
            }
        });

        res.json({
            success: true,
            data: {
                entityType,
                wikidataId,
                database: db,
                properties,
                editableProperties: Object.keys(properties),
                systemProperties: systemProperties.filter(prop => node[prop] !== undefined),
                nodeData: node
            },
            metadata: {
                timestamp: new Date().toISOString(),
                propertyCount: Object.keys(properties).length
            }
        });

    } catch (error) {
        console.error('Get properties error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 🔧 PATCH /api/entity/{entityType}/{wikidataId}/properties/bulk - Mehrere Properties gleichzeitig updaten
router.patch('/entity/:entityType/:wikidataId/properties/bulk', async (req, res) => {
    try {
        const {entityType, wikidataId} = req.params;
        const {updates} = req.body; // Array von {property, value} Objekten
        const {db = 'memgraph'} = req.query;

        console.log(`✏️ BULK UPDATE: ${entityType}:${wikidataId} | ${updates.length} properties | DB: ${db}`);

        if (!updates || !Array.isArray(updates) || updates.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Updates array is required and must not be empty'
            });
        }

        const repo = repositoryFactory.getRepository(entityType, db);

        // 1. Node existiert?
        const existingNode = await repo.findByWikidataId(wikidataId);
        if (!existingNode) {
            return res.status(404).json({
                success: false,
                error: `Node with ID ${wikidataId} not found in ${db}`
            });
        }

        // 2. Bulk Update Query generieren
        let updateResult;
        const updatedProperties = [];

        if (db === 'memgraph') {
            // Cypher SET Statements zusammenbauen
            const setStatements = updates.map((update, index) =>
                `n.${update.property} = $value${index}`
            ).join(', ');

            const params = {wikidataId};
            updates.forEach((update, index) => {
                params[`value${index}`] = update.value;
            });

            const cypherQuery = `
                    MATCH (n:${entityType} {id: $wikidataId})
                    SET ${setStatements}
                    RETURN n
                `;

            updateResult = await repo.executeQuery(cypherQuery, params);

        } else if (db === 'oracle') {
            // Oracle: Einzelne Updates nacheinander (PGQL unterstützt keine Bulk-Property-Updates)
            for (const update of updates) {
                const pgqlQuery = `
                    UPDATE n
                    SET (${update.property} = ?)
                    FROM MATCH (n IS ${entityType.toUpperCase()})
                    ON ALL_GRAPH
                    WHERE n.id = ?
                `;

                await repo.execute({
                    oracle: pgqlQuery
                }, [update.value, wikidataId]);

                updatedProperties.push({
                    property: update.property,
                    newValue: update.value,
                    oldValue: existingNode[update.property] || existingNode[update.property.toUpperCase()]
                });
            }
        }

        // 3. Aktualisierte Node abrufen
        const updatedNode = await repo.findByWikidataId(wikidataId);

        res.json({
            success: true,
            message: `${updates.length} properties updated successfully`,
            data: {
                database: db,
                updatedNode: {
                    entityType,
                    wikidataId,
                    name: updatedNode?.name || updatedNode?.NAME || 'Unknown'
                },
                updatedProperties: updates.map(update => ({
                    property: update.property,
                    newValue: update.value,
                    oldValue: existingNode[update.property] || existingNode[update.property.toUpperCase()],
                    changed: true
                })),
                nodeData: updatedNode
            },
            metadata: {
                timestamp: new Date().toISOString(),
                propertiesUpdated: updates.length,
                database: db,
                operation: 'BULK_UPDATE_PROPERTIES'
            }
        });

    } catch (error) {
        console.error('Bulk property update error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

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
                    FROM MATCH(p:${oracleEntityType})-[:${oracleRelType}]->(t:${oracleTargetType})
                    ON ALL_GRAPH
                    WHERE p.name = '${entityName}'`;
        } else {
            return `SELECT label(r) as relationship_type, t.name, t.id
                    FROM MATCH(p:${oracleEntityType})-[r]->(t)
                    ON ALL_GRAPH
                    WHERE p.name = '${entityName}'`;
        }
    }

    if (queryType === 'find_path') {
        const oracleStartType = getOracleLabelFromEntityType(entityType);
        const oracleTargetType = getOracleLabelFromEntityType(targetEntityType);

        // ✅ NEUE korrekte Syntax wie in findShortestPathOracle
        return `SELECT start_name, end_name, path_length
                FROM GRAPH_TABLE(ALL_GRAPH
                    MATCH (start IS ${oracleStartType}) -[e]-* (end IS ${oracleTargetType})
                    KEEP ANY SHORTEST
                    WHERE start.name = '${entityName}'
                    AND end.name = '${targetEntityName}'
                    COLUMNS(start.name AS start_name,
                    end.name AS end_name,
                    COUNT (EDGE_ID(e)) AS path_length))`;
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