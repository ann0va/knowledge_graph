// src/routes/graph.js - Property Graph Management Routes
const express = require('express');
const router = express.Router();
const PropertyGraphService = require('../services/PropertyGraphService');

module.exports = (repositoryFactory) => {
    const graphService = new PropertyGraphService();

    // POST /api/graph/create - Graph erstellen/neu erstellen
    router.post('/create', async (req, res) => {
        try {
            const { graphName = 'ALL_GRAPH', dropExisting = true } = req.body;

            console.log(`🚀 API: Creating Property Graph '${graphName}'`);

            const result = await graphService.createGraph(graphName, { dropExisting });

            res.json({
                success: true,
                message: `Property Graph '${graphName}' created successfully`,
                data: result
            });

        } catch (error) {
            console.error('❌ API Error creating graph:', error.message);
            res.status(500).json({
                success: false,
                error: error.message,
                details: 'Failed to create Property Graph'
            });
        }
    });

    // DELETE /api/graph/:graphName - Graph löschen
    router.delete('/:graphName', async (req, res) => {
        try {
            const { graphName } = req.params;

            console.log(`🗑️ API: Dropping Property Graph '${graphName}'`);

            const result = await graphService.dropGraph(graphName);

            res.json({
                success: result.success,
                message: result.success
                    ? `Property Graph '${graphName}' dropped successfully`
                    : `Failed to drop Property Graph '${graphName}'`,
                data: result
            });

        } catch (error) {
            console.error('❌ API Error dropping graph:', error.message);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });

    // GET /api/graph/list - Alle verfügbaren Graphs auflisten
    router.get('/list', async (req, res) => {
        try {
            console.log('📋 API: Listing all Property Graphs');

            const graphs = await graphService.listGraphs();

            res.json({
                success: true,
                count: graphs.length,
                data: graphs
            });

        } catch (error) {
            console.error('❌ API Error listing graphs:', error.message);
            res.status(500).json({
                success: false,
                error: error.message,
                data: []
            });
        }
    });

    // GET /api/graph/:graphName/stats - Graph Statistiken
    router.get('/:graphName/stats', async (req, res) => {
        try {
            const { graphName } = req.params;

            console.log(`📊 API: Getting stats for '${graphName}'`);

            const stats = await graphService.getGraphStats(graphName);

            res.json({
                success: true,
                graphName,
                data: stats
            });

        } catch (error) {
            console.error('❌ API Error getting stats:', error.message);
            res.status(500).json({
                success: false,
                error: error.message,
                data: {}
            });
        }
    });

    // GET /api/graph/:graphName/visualization - Visualization Data
    router.get('/:graphName/visualization', async (req, res) => {
        try {
            const { graphName } = req.params;
            const { nodeLimit = 100, edgeLimit = 200 } = req.query;

            console.log(`🎨 API: Getting visualization data for '${graphName}'`);

            const vizData = await graphService.getVisualizationData(graphName, {
                nodeLimit: parseInt(nodeLimit),
                edgeLimit: parseInt(edgeLimit)
            });

            res.json({
                success: true,
                graphName,
                nodeCount: vizData.nodes.length,
                edgeCount: vizData.edges.length,
                data: vizData
            });

        } catch (error) {
            console.error('❌ API Error getting visualization:', error.message);
            res.status(500).json({
                success: false,
                error: error.message,
                data: { nodes: [], edges: [] }
            });
        }
    });

    // GET /api/graph/:graphName/explore - Sample Queries für Exploration
    router.get('/:graphName/explore', async (req, res) => {
        try {
            const { graphName } = req.params;

            console.log(`🔍 API: Running exploration queries for '${graphName}'`);

            const results = await graphService.runSampleQueries(graphName);

            res.json({
                success: true,
                graphName,
                data: results
            });

        } catch (error) {
            console.error('❌ API Error running exploration:', error.message);
            res.status(500).json({
                success: false,
                error: error.message,
                data: {}
            });
        }
    });

    // POST /api/graph/:graphName/query - Custom PGQL Query
    router.post('/:graphName/query', async (req, res) => {
        try {
            const { graphName } = req.params;
            const { query } = req.body;

            if (!query) {
                return res.status(400).json({
                    success: false,
                    error: 'Query is required in request body'
                });
            }

            console.log(`🔍 API: Executing custom PGQL query on '${graphName}'`);
            console.log(`Query: ${query}`);

            const result = await graphService.executeCustomQuery(query, graphName);

            res.json({
                success: result.success,
                graphName,
                query,
                data: result.data || null,
                error: result.error || null,
                rowCount: result.data ? result.data.length : 0
            });

        } catch (error) {
            console.error('❌ API Error executing query:', error.message);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });

    // POST /api/graph/recreate - Komplette Neuerstellung mit Daten-Sync
    router.post('/recreate', async (req, res) => {
        try {
            const { graphName = 'ALL_GRAPH', syncFromMemgraph = false } = req.body;

            console.log(`🔄 API: Recreating Property Graph '${graphName}'`);

            // 1. Graph erstellen
            const createResult = await graphService.createGraph(graphName);

            // 2. Optional: Daten von Memgraph synchronisieren
            let syncResult = null;
            if (syncFromMemgraph) {
                console.log('🔄 Synchronizing data from Memgraph...');
                // TODO: Hier würde die Synchronisation mit GraphService kommen
                syncResult = { message: 'Sync from Memgraph not yet implemented' };
            }

            res.json({
                success: true,
                message: `Property Graph '${graphName}' recreated successfully`,
                data: {
                    create: createResult,
                    sync: syncResult
                }
            });

        } catch (error) {
            console.error('❌ API Error recreating graph:', error.message);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });

    // GET /api/graph/health - Health Check für Property Graph Service
    router.get('/health', async (req, res) => {
        try {
            const health = {
                status: 'ok',
                timestamp: new Date().toISOString(),
                service: 'PropertyGraphService'
            };

            // Teste Authentication
            try {
                await graphService.authenticate();
                health.authentication = 'ok';
            } catch (e) {
                health.authentication = 'failed';
                health.authError = e.message;
            }

            // Liste verfügbare Graphs
            try {
                const graphs = await graphService.listGraphs();
                health.availableGraphs = graphs.length;
                health.graphs = graphs.map(g => g.name);
            } catch (e) {
                health.availableGraphs = 'error';
                health.graphsError = e.message;
            }

            const statusCode = health.authentication === 'ok' ? 200 : 503;
            res.status(statusCode).json(health);

        } catch (error) {
            res.status(500).json({
                status: 'error',
                error: error.message
            });
        }
    });

    return router;
};