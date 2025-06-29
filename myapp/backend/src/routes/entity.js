// src/routes/entity.js - FIXED: Dropdown Support für alle Entities
const express = require('express');

module.exports = (repositoryFactory) => {
    const router = express.Router();

    // 🎯 GET /api/entity/types - Alle verfügbaren Entity-Typen
    router.get('/types', async (req, res) => {
        try {
            res.json({
                success: true,
                entityTypes: repositoryFactory.getAvailableEntityTypes(),
                relationshipTypes: repositoryFactory.getAvailableRelationshipTypes(),
                usage: {
                    getAllEntities: 'GET /api/entity/{type}?db={oracle|memgraph}',
                    getEntityById: 'GET /api/entity/{type}/{id}?db={oracle|memgraph}',
                    searchEntities: 'GET /api/entity/{type}/search?q={term}&db={oracle|memgraph}',
                    getRelationships: 'GET /api/entity/{type}/{id}/relationships?db={oracle|memgraph}'
                }
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });

    // 🎯 GET /api/entity/:entityType - Alle Entities eines Typs
    router.get('/:entityType', async (req, res) => {
        try {
            const { entityType } = req.params;
            const { db = 'memgraph', limit = 100, offset = 0 } = req.query;

            // Validierung
            if (!repositoryFactory.getAvailableEntityTypes().includes(entityType)) {
                return res.status(400).json({
                    success: false,
                    error: `Invalid entity type: ${entityType}`,
                    availableTypes: repositoryFactory.getAvailableEntityTypes()
                });
            }

            // Repository abrufen und Daten holen
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

    // 🎯 GET /api/entity/:entityType/search - Suche in Entity-Type (FIXED für Dropdown)
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

            // 🔧 FIXED: Leerer Suchterm = alle Entities für Dropdown
            if (!searchTerm || searchTerm.trim() === '') {
                console.log(`🔍 Loading all ${entityType} entities for dropdown (limit: ${limit})`);
                results = await repo.findAll(parseInt(limit));
            } else {
                console.log(`🔍 Searching ${entityType} for: "${searchTerm}"`);
                results = await repo.searchByName(searchTerm, parseInt(limit));
            }

            // Namen für Frontend Dropdown extrahieren
            const suggestions = results.map(entity => {
                if (db === 'oracle') {
                    return entity.NAME || entity.name;
                } else {
                    // Memgraph: verschiedene mögliche Formate
                    return entity['e.name'] || entity.name || entity.title;
                }
            }).filter(name => name && name.trim() !== ''); // Nur gültige Namen

            console.log(`📋 Extracted ${suggestions.length} entity names for dropdown`);

            res.json({
                success: true,
                data: {
                    suggestions, // Frontend erwartet "suggestions" Array
                    results: results, // Vollständige Daten falls benötigt
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

    // 🎯 GET /api/entity/:entityType/:id - Spezifische Entity (VEREINFACHT)
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

            // EINFACH: Beide DBs nutzen jetzt Wikidata-IDs als Properties
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

    // 🎯 GET /api/entity/:entityType/:id/relationships - Entity Beziehungen
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

            // Spezifischen Relationship-Type abfragen
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
                // Alle Beziehungen
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

    return router;
};