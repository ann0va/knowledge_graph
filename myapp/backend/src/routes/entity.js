// src/routes/entity.js - ENHANCED with CREATE endpoints
const express = require('express');

module.exports = (repositoryFactory) => {
    const router = express.Router();

    // 🎯 GET /api/entity/types - Alle verfügbaren Entity-Typen + Edge-Typen
    router.get('/types', async (req, res) => {
        try {
            const EntityRepository = require('../repositories/EntityRepository');

            res.json({
                success: true,
                entityTypes: repositoryFactory.getAvailableEntityTypes(),
                relationshipTypes: repositoryFactory.getAvailableRelationshipTypes(),
                edgeTypes: EntityRepository.getAvailableEdgeTypes(), // 🆕 Verfügbare Edge-Typen
                entityConfigs: EntityRepository.getAllEntityConfigs(), // 🆕 Für Frontend Forms
                edgeConfigs: EntityRepository.getAllEdgeConfigs(), // 🆕 Für Edge Creation Forms
                usage: {
                    getAllEntities: 'GET /api/entity/{type}?db={oracle|memgraph}',
                    getEntityById: 'GET /api/entity/{type}/{id}?db={oracle|memgraph}',
                    searchEntities: 'GET /api/entity/{type}/search?q={term}&db={oracle|memgraph}',
                    getRelationships: 'GET /api/entity/{type}/{id}/relationships?db={oracle|memgraph}',
                    createNode: 'POST /api/entity/{type}/create?db={oracle|memgraph}',
                    createEdge: 'POST /api/entity/edge/create?db={oracle|memgraph}'
                }
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });

    // 🆕 POST /api/entity/edge/create - Neue Beziehung erstellen (MUSS VOR /:entityType stehen!)
    router.post('/edge/create', async (req, res) => {
        console.log('🚨 EDGE CREATE ROUTE REACHED!');
        console.log('🚨 req.body RAW:', JSON.stringify(req.body));
        console.log('🚨 req.body keys:', Object.keys(req.body || {}));
        console.log('🚨 req.body.sourceEntityType:', req.body.sourceEntityType);
        console.log('🚨 typeof req.body.sourceEntityType:', typeof req.body.sourceEntityType);
        console.log('🚨 req.query:', req.query);

        try {
            const { db = 'memgraph' } = req.query;
            const edgeData = req.body;

            console.log(`🆕 CREATE EDGE request:`, { db, edgeData });
            console.log(`🆕 Request body keys:`, Object.keys(req.body));
            console.log(`🆕 Full request body:`, JSON.stringify(req.body, null, 2));

            // Validierung
            const { relationshipType, sourceEntityType, sourceId, targetEntityType, targetId } = edgeData;

            console.log('🔧 Edge data validation:');
            console.log('  relationshipType:', relationshipType);
            console.log('  sourceEntityType:', sourceEntityType);
            console.log('  sourceId:', sourceId);
            console.log('  targetEntityType:', targetEntityType);
            console.log('  targetId:', targetId);

            if (!relationshipType || !sourceId || !targetId) {
                console.log('❌ Missing required fields in validation');
                return res.status(400).json({
                    success: false,
                    error: 'relationshipType, sourceId, and targetId are required',
                    received: { relationshipType, sourceId, targetId }
                });
            }

            const EntityRepository = require('../repositories/EntityRepository');
            const availableEdgeTypes = EntityRepository.getAvailableEdgeTypes();

            console.log('🔧 Available edge types:', availableEdgeTypes);
            console.log('🔧 Checking if', relationshipType, 'is in available types...');

            if (!availableEdgeTypes.includes(relationshipType)) {
                console.log('❌ Invalid relationship type');
                return res.status(400).json({
                    success: false,
                    error: `Invalid relationship type: ${relationshipType}`,
                    availableTypes: availableEdgeTypes
                });
            }

            // Prüfe ob Source und Target Entity Types valid sind
            const availableEntityTypes = repositoryFactory.getAvailableEntityTypes();
            console.log('🔧 Available entity types:', availableEntityTypes);

            if (sourceEntityType && !availableEntityTypes.includes(sourceEntityType)) {
                console.log('❌ Invalid source entity type');
                return res.status(400).json({
                    success: false,
                    error: `Invalid source entity type: ${sourceEntityType}`,
                    availableTypes: availableEntityTypes
                });
            }

            if (targetEntityType && !availableEntityTypes.includes(targetEntityType)) {
                console.log('❌ Invalid target entity type');
                return res.status(400).json({
                    success: false,
                    error: `Invalid target entity type: ${targetEntityType}`,
                    availableTypes: availableEntityTypes
                });
            }

            // Repository für Edge Creation verwenden - nutze Source Entity Type
            const entityTypeForRepo = sourceEntityType || 'person';
            console.log(`🔧 Using repository for entity type: ${entityTypeForRepo}`);
            console.log(`🔧 Database: ${db}`);

            const repo = repositoryFactory.getRepository(entityTypeForRepo, db);
            console.log(`🔧 Repository created:`, repo.constructor.name);

            const result = await repo.createEdge(edgeData);

            res.status(201).json({
                success: true,
                message: `${relationshipType} edge created successfully`,
                data: result,
                metadata: {
                    relationshipType,
                    sourceId,
                    targetId,
                    database: db,
                    timestamp: new Date().toISOString()
                }
            });

        } catch (error) {
            console.error('❌ Error creating edge:', error);
            console.error('❌ Error stack:', error.stack);
            res.status(500).json({
                success: false,
                error: error.message,
                details: error.stack
            });
        }
    });

    // 🆕 POST /api/entity/:entityType/create - Neuen Knoten erstellen (NACH /edge/create!)
    router.post('/:entityType/create', async (req, res) => {
        try {
            const { entityType } = req.params;
            const { db = 'memgraph' } = req.query;
            const nodeData = req.body;

            console.log(`🆕 CREATE ${entityType} request:`, { db, nodeData });

            // Validierung
            if (!repositoryFactory.getAvailableEntityTypes().includes(entityType)) {
                return res.status(400).json({
                    success: false,
                    error: `Invalid entity type: ${entityType}`,
                    availableTypes: repositoryFactory.getAvailableEntityTypes()
                });
            }

            if (!nodeData || Object.keys(nodeData).length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Request body with node data is required'
                });
            }

            // Repository abrufen und Node erstellen
            const repo = repositoryFactory.getRepository(entityType, db);
            const result = await repo.createNode(nodeData);

            res.status(201).json({
                success: true,
                message: `${entityType} node created successfully`,
                data: result,
                metadata: {
                    entityType,
                    database: db,
                    wikidataId: result.wikidataId,
                    timestamp: new Date().toISOString()
                }
            });

        } catch (error) {
            console.error(`Error creating ${req.params.entityType}:`, error);
            res.status(500).json({
                success: false,
                error: error.message,
                details: error.stack
            });
        }
    });

    // 🆕 POST /api/entity/edge/create - Neue Beziehung erstellen
    router.post('/edge/create', async (req, res) => {
        console.log('🚨 EDGE CREATE ROUTE REACHED!');
        console.log('🚨 req.body:', req.body);
        console.log('🚨 req.query:', req.query);

        try {
            const { db = 'memgraph' } = req.query;
            const edgeData = req.body;

            console.log(`🆕 CREATE EDGE request:`, { db, edgeData });
            console.log(`🆕 Request body keys:`, Object.keys(req.body));
            console.log(`🆕 Full request body:`, JSON.stringify(req.body, null, 2));

            // Validierung
            const { relationshipType, sourceEntityType, sourceId, targetEntityType, targetId } = edgeData;

            console.log('🔧 Edge data validation:');
            console.log('  relationshipType:', relationshipType);
            console.log('  sourceEntityType:', sourceEntityType);
            console.log('  sourceId:', sourceId);
            console.log('  targetEntityType:', targetEntityType);
            console.log('  targetId:', targetId);

            if (!relationshipType || !sourceId || !targetId) {
                console.log('❌ Missing required fields in validation');
                return res.status(400).json({
                    success: false,
                    error: 'relationshipType, sourceId, and targetId are required',
                    received: { relationshipType, sourceId, targetId }
                });
            }

            const EntityRepository = require('../repositories/EntityRepository');
            const availableEdgeTypes = EntityRepository.getAvailableEdgeTypes();

            console.log('🔧 Available edge types:', availableEdgeTypes);
            console.log('🔧 Checking if', relationshipType, 'is in available types...');

            if (!availableEdgeTypes.includes(relationshipType)) {
                console.log('❌ Invalid relationship type');
                return res.status(400).json({
                    success: false,
                    error: `Invalid relationship type: ${relationshipType}`,
                    availableTypes: availableEdgeTypes
                });
            }

            // Prüfe ob Source und Target Entity Types valid sind
            const availableEntityTypes = repositoryFactory.getAvailableEntityTypes();
            console.log('🔧 Available entity types:', availableEntityTypes);

            if (sourceEntityType && !availableEntityTypes.includes(sourceEntityType)) {
                console.log('❌ Invalid source entity type');
                return res.status(400).json({
                    success: false,
                    error: `Invalid source entity type: ${sourceEntityType}`,
                    availableTypes: availableEntityTypes
                });
            }

            if (targetEntityType && !availableEntityTypes.includes(targetEntityType)) {
                console.log('❌ Invalid target entity type');
                return res.status(400).json({
                    success: false,
                    error: `Invalid target entity type: ${targetEntityType}`,
                    availableTypes: availableEntityTypes
                });
            }

            // Repository für Edge Creation verwenden - nutze Source Entity Type
            const entityTypeForRepo = sourceEntityType || 'person';
            console.log(`🔧 Using repository for entity type: ${entityTypeForRepo}`);
            console.log(`🔧 Database: ${db}`);

            const repo = repositoryFactory.getRepository(entityTypeForRepo, db);
            console.log(`🔧 Repository created:`, repo.constructor.name);

            const result = await repo.createEdge(edgeData);

            res.status(201).json({
                success: true,
                message: `${relationshipType} edge created successfully`,
                data: result,
                metadata: {
                    relationshipType,
                    sourceId,
                    targetId,
                    database: db,
                    timestamp: new Date().toISOString()
                }
            });

        } catch (error) {
            console.error('❌ Error creating edge:', error);
            console.error('❌ Error stack:', error.stack);
            res.status(500).json({
                success: false,
                error: error.message,
                details: error.stack
            });
        }
    });

    // 🎯 GET /api/entity/:entityType - Alle Entities eines Typs (BESTEHEND)
    router.get('/:entityType', async (req, res) => {
        try {
            const { entityType } = req.params;
            const { db = 'memgraph', limit = 100, offset = 0 } = req.query;

            if (!repositoryFactory.getAvailableEntityTypes().includes(entityType)) {
                return res.status(400).json({
                    success: false,
                    error: `Invalid entity type: ${entityType}`,
                    availableTypes: repositoryFactory.getAvailableEntityTypes()
                });
            }

            const repo = repositoryFactory.getRepository(entityType, db);
            const entities = await repo.findAll(parseInt(limit));
            const stats = await repo.getStats();

            res.json({
                success: true,
                data: {
                    entities,
                    metadata: {
                        entityType,
                        database: db,
                        count: entities.length,
                        totalCount: stats.total_count,
                        limit: parseInt(limit),
                        offset: parseInt(offset)
                    }
                }
            });

        } catch (error) {
            console.error(`Error fetching ${req.params.entityType}:`, error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });

    // 🎯 GET /api/entity/:entityType/search - Suche in Entity-Type (BESTEHEND)
    router.get('/:entityType/search', async (req, res) => {
        try {
            const { entityType } = req.params;
            const { q: searchTerm, db = 'memgraph', limit = 100 } = req.query;

            if (!repositoryFactory.getAvailableEntityTypes().includes(entityType)) {
                return res.status(400).json({
                    success: false,
                    error: `Invalid entity type: ${entityType}`,
                    availableTypes: repositoryFactory.getAvailableEntityTypes()
                });
            }

            const repo = repositoryFactory.getRepository(entityType, db);
            let results;

            if (!searchTerm || searchTerm.trim() === '') {
                console.log(`🔍 Loading all ${entityType} entities for dropdown (limit: ${limit})`);
                results = await repo.findAll(parseInt(limit));
            } else {
                console.log(`🔍 Searching ${entityType} for: "${searchTerm}"`);
                results = await repo.searchByName(searchTerm, parseInt(limit));
            }

            const suggestions = results.map(entity => {
                if (db === 'oracle') {
                    return entity.NAME || entity.name;
                } else {
                    return entity['e.name'] || entity.name || entity.title;
                }
            }).filter(name => name && name.trim() !== '');

            console.log(`📋 Extracted ${suggestions.length} entity names for dropdown`);

            res.json({
                success: true,
                data: {
                    suggestions,
                    results: results,
                    metadata: {
                        entityType,
                        database: db,
                        searchTerm: searchTerm || '(all)',
                        count: suggestions.length,
                        totalResults: results.length,
                        limit: parseInt(limit),
                        mode: searchTerm ? 'search' : 'all'
                    }
                }
            });

        } catch (error) {
            console.error(`Error searching ${req.params.entityType}:`, error);
            res.status(500).json({
                success: false,
                error: error.message,
                details: error.stack
            });
        }
    });

    // 🎯 GET /api/entity/:entityType/:id - Spezifische Entity (BESTEHEND)
    router.get('/:entityType/:id', async (req, res) => {
        try {
            const { entityType, id } = req.params;
            const { db = 'memgraph' } = req.query;

            if (!repositoryFactory.getAvailableEntityTypes().includes(entityType)) {
                return res.status(400).json({
                    success: false,
                    error: `Invalid entity type: ${entityType}`,
                    availableTypes: repositoryFactory.getAvailableEntityTypes()
                });
            }

            const repo = repositoryFactory.getRepository(entityType, db);
            const entity = await repo.findById(id);

            if (!entity) {
                return res.status(404).json({
                    success: false,
                    error: `${entityType} with Wikidata ID ${id} not found in ${db}`,
                    hint: 'Make sure the Wikidata ID exists in the specified database.'
                });
            }

            res.json({
                success: true,
                data: {
                    entity,
                    metadata: {
                        entityType,
                        database: db,
                        wikidataId: id,
                        lookupMethod: 'wikidata_property_based'
                    }
                }
            });

        } catch (error) {
            console.error(`Error fetching ${req.params.entityType} ${req.params.id}:`, error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });

    // 🎯 GET /api/entity/:entityType/:id/relationships - Entity Beziehungen (BESTEHEND)
    router.get('/:entityType/:id/relationships', async (req, res) => {
        try {
            const { entityType, id } = req.params;
            const { db = 'memgraph', direction = 'both', type } = req.query;

            if (!repositoryFactory.getAvailableEntityTypes().includes(entityType)) {
                return res.status(400).json({
                    success: false,
                    error: `Invalid entity type: ${entityType}`,
                    availableTypes: repositoryFactory.getAvailableEntityTypes()
                });
            }

            const repo = repositoryFactory.getRepository(entityType, db);
            let relationships = {};

            if (type) {
                if (!repositoryFactory.getAvailableRelationshipTypes().includes(type)) {
                    return res.status(400).json({
                        success: false,
                        error: `Invalid relationship type: ${type}`,
                        availableTypes: repositoryFactory.getAvailableRelationshipTypes()
                    });
                }

                if (direction === 'outgoing' || direction === 'both') {
                    relationships.outgoing = await repo.getSpecificRelationships(id, type, 'outgoing');
                }
                if (direction === 'incoming' || direction === 'both') {
                    relationships.incoming = await repo.getSpecificRelationships(id, type, 'incoming');
                }
            } else {
                if (direction === 'outgoing' || direction === 'both') {
                    relationships.outgoing = await repo.getRelationships(id);
                }
                if (direction === 'incoming' || direction === 'both') {
                    relationships.incoming = await repo.getIncomingRelationships(id);
                }
            }

            res.json({
                success: true,
                data: {
                    relationships,
                    metadata: {
                        entityType,
                        entityId: id,
                        database: db,
                        direction,
                        relationshipType: type || 'all',
                        availableRelationshipTypes: repositoryFactory.getAvailableRelationshipTypes()
                    }
                }
            });

        } catch (error) {
            console.error(`Error fetching relationships for ${req.params.entityType} ${req.params.id}:`, error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });

    // 🗑️ DELETE /api/entity/edge/delete - Edge löschen
    router.delete('/edge/delete', async (req, res) => {
        console.log('🗑️ EDGE DELETE ROUTE REACHED!');
        console.log('🗑️ req.body:', req.body);
        console.log('🗑️ req.query:', req.query);

        try {
            const { db = 'memgraph' } = req.query;
            const edgeData = req.body;

            console.log(`🗑️ DELETE EDGE request:`, { db, edgeData });

            // Validation
            const { relationshipType, sourceId, targetId } = edgeData;

            if (!relationshipType || !sourceId || !targetId) {
                return res.status(400).json({
                    success: false,
                    error: 'relationshipType, sourceId, and targetId are required',
                    received: { relationshipType, sourceId, targetId }
                });
            }

            const EntityRepository = require('../repositories/EntityRepository');
            const availableEdgeTypes = EntityRepository.getAvailableEdgeTypes();

            if (!availableEdgeTypes.includes(relationshipType)) {
                return res.status(400).json({
                    success: false,
                    error: `Invalid relationship type: ${relationshipType}`,
                    availableTypes: availableEdgeTypes
                });
            }

            // Repository für Edge Deletion verwenden - nutze Source Entity Type
            const edgeConfig = EntityRepository.getEdgeConfig(relationshipType);
            const entityTypeForRepo = edgeConfig?.source_type || 'person';

            console.log(`🔧 Using repository for entity type: ${entityTypeForRepo}`);

            const repo = repositoryFactory.getRepository(entityTypeForRepo, db);
            const result = await repo.deleteEdge(edgeData);

            res.json({
                success: true,
                message: `${relationshipType} edge deleted successfully`,
                data: result,
                metadata: {
                    relationshipType,
                    sourceId,
                    targetId,
                    database: db,
                    timestamp: new Date().toISOString(),
                    operation: 'delete_edge'
                }
            });

        } catch (error) {
            console.error('❌ Error deleting edge:', error);

            const statusCode = error.message.includes('not found') ? 404 : 500;

            res.status(statusCode).json({
                success: false,
                error: error.message,
                details: error.stack,
                metadata: {
                    operation: 'delete_edge',
                    database: req.query.db || 'memgraph'
                }
            });
        }
    });

    // 🗑️ DELETE /api/entity/:entityType/:id - Node löschen
    router.delete('/:entityType/:id', async (req, res) => {
        try {
            const { entityType, id: wikidataId } = req.params;
            const { db = 'memgraph' } = req.query;

            console.log(`🗑️ DELETE ${entityType} request: ${wikidataId} from ${db}`);

            // Validation
            if (!repositoryFactory.getAvailableEntityTypes().includes(entityType)) {
                return res.status(400).json({
                    success: false,
                    error: `Invalid entity type: ${entityType}`,
                    availableTypes: repositoryFactory.getAvailableEntityTypes()
                });
            }

            if (!wikidataId || wikidataId.trim() === '') {
                return res.status(400).json({
                    success: false,
                    error: 'Wikidata ID is required for deletion'
                });
            }

            // Repository abrufen und Node löschen
            const repo = repositoryFactory.getRepository(entityType, db);
            const result = await repo.deleteNode(wikidataId);

            res.json({
                success: true,
                message: `${entityType} node deleted successfully`,
                data: result,
                metadata: {
                    entityType,
                    database: db,
                    wikidataId: wikidataId,
                    timestamp: new Date().toISOString(),
                    operation: 'delete_node'
                }
            });

        } catch (error) {
            console.error(`Error deleting ${req.params.entityType} ${req.params.id}:`, error);

            const statusCode = error.message.includes('not found') ? 404 : 500;

            res.status(statusCode).json({
                success: false,
                error: error.message,
                details: error.stack,
                metadata: {
                    entityType: req.params.entityType,
                    wikidataId: req.params.id,
                    database: req.query.db || 'memgraph',
                    operation: 'delete_node'
                }
            });
        }
    });



// 🗑️ DELETE /api/entity/:entityType/bulk - Bulk Node Deletion
    router.delete('/:entityType/bulk', async (req, res) => {
        try {
            const { entityType } = req.params;
            const { db = 'memgraph' } = req.query;
            const { wikidataIds } = req.body;

            console.log(`🗑️ BULK DELETE ${entityType} request: ${wikidataIds?.length} nodes from ${db}`);

            // Validation
            if (!repositoryFactory.getAvailableEntityTypes().includes(entityType)) {
                return res.status(400).json({
                    success: false,
                    error: `Invalid entity type: ${entityType}`,
                    availableTypes: repositoryFactory.getAvailableEntityTypes()
                });
            }

            if (!wikidataIds || !Array.isArray(wikidataIds) || wikidataIds.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Array of wikidataIds is required for bulk deletion'
                });
            }

            if (wikidataIds.length > 100) {
                return res.status(400).json({
                    success: false,
                    error: 'Maximum 100 nodes can be deleted in one bulk operation'
                });
            }

            // Repository abrufen und Bulk Delete ausführen
            const repo = repositoryFactory.getRepository(entityType, db);
            const result = await repo.bulkDeleteNodes(wikidataIds);

            const statusCode = result.success ? 200 : 207; // 207 = Multi-Status

            res.status(statusCode).json({
                success: result.success,
                message: `Bulk delete completed: ${result.totalDeleted}/${result.totalRequested} nodes deleted`,
                data: result,
                metadata: {
                    entityType,
                    database: db,
                    requestedCount: result.totalRequested,
                    deletedCount: result.totalDeleted,
                    failedCount: result.totalFailed,
                    timestamp: new Date().toISOString(),
                    operation: 'bulk_delete_nodes'
                }
            });

        } catch (error) {
            console.error(`Error in bulk delete ${req.params.entityType}:`, error);
            res.status(500).json({
                success: false,
                error: error.message,
                details: error.stack,
                metadata: {
                    entityType: req.params.entityType,
                    database: req.query.db || 'memgraph',
                    operation: 'bulk_delete_nodes'
                }
            });
        }
    });

// 🔧 PATCH /api/entity/person/{wikidataId}/properties - Person Property Update (vereinfacht)
    router.patch('/person/:wikidataId/properties', async (req, res) => {
        try {
            const { wikidataId } = req.params;
            const { property, value } = req.body;
            const { db = 'memgraph' } = req.query;

            console.log(`✏️ PERSON UPDATE: ${wikidataId} | ${property} = "${value}" | DB: ${db}`);

            // Validierung
            if (!property || value === undefined || value === null) {
                return res.status(400).json({
                    success: false,
                    error: 'Property name and value are required'
                });
            }

            // Person-spezifische Property-Validierung
            const validPersonProperties = ['name', 'birth_date', 'death_date', 'gender', 'description'];
            if (!validPersonProperties.includes(property)) {
                return res.status(400).json({
                    success: false,
                    error: `Invalid person property: ${property}. Valid properties: ${validPersonProperties.join(', ')}`
                });
            }

            // Datum-Validierung
            if ((property === 'birth_date' || property === 'death_date') && value) {
                const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
                if (!dateRegex.test(value)) {
                    return res.status(400).json({
                        success: false,
                        error: 'Date must be in YYYY-MM-DD format'
                    });
                }
            }

            const repo = repositoryFactory.getRepository('person', db);

            // 1. Person existiert?
            let existingPerson;
            try {
                existingPerson = await repo.findById(wikidataId);
                if (!existingPerson) {
                    return res.status(404).json({
                        success: false,
                        error: `Person with ID ${wikidataId} not found in ${db}`
                    });
                }
            } catch (findError) {
                console.error('Error finding person for update:', findError);
                return res.status(404).json({
                    success: false,
                    error: `Person with ID ${wikidataId} not found: ${findError.message}`
                });
            }

            // 2. Aktuellen Wert abrufen - FIXED für Oracle Case-Sensitivity
            let currentValue = null;
            if (db === 'oracle') {
                // Oracle: Versuche beide Cases
                const oracleKey = property.toUpperCase();
                currentValue = existingPerson[oracleKey] || existingPerson[property];

                console.log(`📝 Oracle property lookup: ${property} -> ${oracleKey}`, {
                    oracleKey,
                    value: currentValue,
                    availableKeys: Object.keys(existingPerson)
                });
            } else {
                currentValue = existingPerson[property] || existingPerson[`e.${property}`];
            }

            console.log(`📝 Current value for ${property}:`, currentValue);
            console.log(`📝 New value:`, value);

            // 3. Cross-field Validierung - FIXED für Oracle Case-Sensitivity
            if (property === 'death_date' && value) {
                let birthDateValue = null;

                if (db === 'oracle') {
                    birthDateValue = existingPerson.BIRTH_DATE || existingPerson.birth_date;
                } else {
                    birthDateValue = existingPerson.birth_date || existingPerson['e.birth_date'];
                }

                if (birthDateValue) {
                    // Formatiere Oracle-Datum falls nötig
                    if (typeof birthDateValue === 'string' && birthDateValue.includes(' ')) {
                        birthDateValue = birthDateValue.split(' ')[0];
                    }

                    const birthDate = new Date(birthDateValue);
                    const deathDate = new Date(value);
                    if (deathDate <= birthDate) {
                        return res.status(400).json({
                            success: false,
                            error: 'Death date must be after birth date'
                        });
                    }
                }
            }

            // 4. Update Query ausführen - COMPLETELY DIFFERENT for Oracle
            let updateResult;

            if (db === 'memgraph') {
                // Memgraph Cypher UPDATE (funktioniert)
                const cypherQuery = `
                    MATCH (n:person {id: $wikidataId})
                    SET n.${property} = $newValue
                    RETURN n
                `;

                console.log(`🔍 Memgraph PERSON UPDATE:`, cypherQuery);

                updateResult = await repo.execute({
                    memgraph: cypherQuery
                }, {
                    wikidataId,
                    newValue: value
                });

            } else if (db === 'oracle') {
                // 🔧 ORACLE: Use direct SQL UPDATE (PGQL UPDATE doesn't work!)
                console.log(`🔍 Oracle PERSON UPDATE: Using direct SQL instead of PGQL`);

                try {
                    const { getOracleConnection } = require('../config/database');
                    let connection = await getOracleConnection();

                    // 🔧 Map frontend property names to Oracle column names
                    const oracleColumnMap = {
                        'name': 'NAME',
                        'birth_date': 'BIRTH_DATE',
                        'death_date': 'DEATH_DATE',
                        'gender': 'GENDER',
                        'description': 'DESCRIPTION'
                    };

                    const oracleColumn = oracleColumnMap[property] || property.toUpperCase();

                    // Direct SQL UPDATE
                    const sqlUpdateQuery = `UPDATE PERSONS SET ${oracleColumn} = :newValue WHERE id = :wikidataId`;

                    console.log(`🔍 Oracle SQL UPDATE:`, sqlUpdateQuery);
                    console.log(`🔍 Oracle SQL params:`, { newValue: value, wikidataId });

                    const sqlResult = await connection.execute(sqlUpdateQuery, {
                        newValue: value,
                        wikidataId: wikidataId
                    }, { autoCommit: true });

                    await connection.close();

                    console.log(`✅ Oracle SQL UPDATE result:`, sqlResult);

                    if (sqlResult.rowsAffected === 0) {
                        throw new Error(`No person found with ID ${wikidataId} in Oracle`);
                    }

                    // Simulate update result for consistency
                    updateResult = {
                        success: true,
                        rowsAffected: sqlResult.rowsAffected,
                        method: 'oracle_sql_update'
                    };

                } catch (oracleError) {
                    console.error(`❌ Oracle SQL UPDATE failed:`, oracleError);
                    throw new Error(`Oracle SQL UPDATE failed: ${oracleError.message}`);
                }

            } else {
                throw new Error(`Unsupported database: ${db}`);
            }

            console.log(`✅ Person update result:`, updateResult);

            // 5. Aktualisierte Person abrufen
            let updatedPerson;
            try {
                updatedPerson = await repo.findById(wikidataId);
            } catch (fetchError) {
                console.warn('Could not fetch updated person:', fetchError);
                updatedPerson = null;
            }

            // 6. Response
            res.json({
                success: true,
                message: `Person property '${property}' updated successfully`,
                data: {
                    database: db,
                    updatedNode: {
                        entityType: 'person',
                        wikidataId,
                        name: updatedPerson?.name || updatedPerson?.NAME || updatedPerson?.['e.name'] || 'Unknown'
                    },
                    updatedProperty: {
                        name: property,
                        oldValue: currentValue,
                        newValue: value,
                        changed: currentValue !== value
                    },
                    personData: updatedPerson
                },
                metadata: {
                    timestamp: new Date().toISOString(),
                    entityType: 'person',
                    wikidataId,
                    database: db,
                    operation: 'UPDATE_PERSON_PROPERTY'
                }
            });

        } catch (error) {
            console.error('Person property update error:', error);
            res.status(500).json({
                success: false,
                error: error.message,
                details: {
                    operation: 'UPDATE_PERSON_PROPERTY',
                    wikidataId: req.params.wikidataId,
                    property: req.body.property,
                    database: req.query.db || 'memgraph'
                }
            });
        }
    });

    // 🔧 GET /api/entity/person/{wikidataId}/properties - Person Properties abrufen (vereinfacht)
    router.get('/person/:wikidataId/properties', async (req, res) => {
        try {
            const { wikidataId } = req.params;
            const { db = 'memgraph' } = req.query;

            console.log(`📋 GET Person Properties: ${wikidataId} | DB: ${db}`);

            const repo = repositoryFactory.getRepository('person', db);

            // Person abrufen
            const person = await repo.findById(wikidataId);

            if (!person) {
                return res.status(404).json({
                    success: false,
                    error: `Person with ID ${wikidataId} not found in ${db}`
                });
            }

            // Person-Properties extrahieren
            const personProperties = ['name', 'birth_date', 'death_date', 'gender', 'description'];
            const properties = {};

            personProperties.forEach(prop => {
                if (db === 'oracle') {
                    properties[prop] = person[prop] || person[prop.toUpperCase()] || null;
                } else {
                    properties[prop] = person[prop] || person[`e.${prop}`] || null;
                }
            });

            // Zusätzliche Properties falls vorhanden
            Object.keys(person).forEach(key => {
                if (!['id', 'ID', 'VERTEX_ID', 'vertex_id', 'labels', 'all_properties'].includes(key)
                    && !personProperties.includes(key)
                    && !key.startsWith('e.')) {
                    properties[key] = person[key];
                }
            });

            res.json({
                success: true,
                data: {
                    entityType: 'person',
                    wikidataId,
                    database: db,
                    properties,
                    editableProperties: personProperties,
                    personData: person
                },
                metadata: {
                    timestamp: new Date().toISOString(),
                    propertyCount: Object.keys(properties).length
                }
            });

        } catch (error) {
            console.error('Get person properties error:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });
    
    return router;
};