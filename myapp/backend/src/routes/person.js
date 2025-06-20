// src/routes/person.js - Person API Routes
const express = require('express');
const router = express.Router();

module.exports = (repositoryFactory) => {
    // GET /api/person - Alle Personen abrufen
    router.get('/', async (req, res) => {
        try {
            const { source = 'both', limit = 100 } = req.query;
            const results = {};

            if (source === 'oracle' || source === 'both') {
                const oracleRepo = repositoryFactory.getRepository('person', 'oracle');
                results.oracle = await oracleRepo.findAll(parseInt(limit));
            }

            if (source === 'memgraph' || source === 'both') {
                const memgraphRepo = repositoryFactory.getRepository('person', 'memgraph');
                results.memgraph = await memgraphRepo.findAll(parseInt(limit));
            }

            res.json({
                success: true,
                source,
                data: results
            });
        } catch (error) {
            console.error('Fehler beim Abrufen der Personen:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });

    // GET /api/person/:id - Person nach ID
    router.get('/:id', async (req, res) => {
        try {
            const { id } = req.params;
            const { source = 'both' } = req.query;
            const results = {};

            if (source === 'oracle' || source === 'both') {
                const oracleRepo = repositoryFactory.getRepository('person', 'oracle');
                results.oracle = await oracleRepo.findById(id);
            }

            if (source === 'memgraph' || source === 'both') {
                const memgraphRepo = repositoryFactory.getRepository('person', 'memgraph');
                results.memgraph = await memgraphRepo.findById(id);
            }

            res.json({
                success: true,
                source,
                data: results
            });
        } catch (error) {
            console.error('Fehler beim Abrufen der Person:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });

    // GET /api/person/:id/relationships - Beziehungen einer Person
    router.get('/:id/relationships', async (req, res) => {
        try {
            const { id } = req.params;
            const { source = 'both' } = req.query;
            const results = {};

            if (source === 'oracle' || source === 'both') {
                const oracleRepo = repositoryFactory.getRepository('person', 'oracle');
                results.oracle = await oracleRepo.getRelationships(id);
            }

            if (source === 'memgraph' || source === 'both') {
                const memgraphRepo = repositoryFactory.getRepository('person', 'memgraph');
                results.memgraph = await memgraphRepo.getRelationships(id);
            }

            res.json({
                success: true,
                source,
                data: results
            });
        } catch (error) {
            console.error('Fehler beim Abrufen der Beziehungen:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });

    // POST /api/person - Neue Person erstellen
    router.post('/', async (req, res) => {
        try {
            const personData = req.body;
            const { target = 'both' } = req.query;
            const results = {};

            if (target === 'oracle' || target === 'both') {
                const oracleRepo = repositoryFactory.getRepository('person', 'oracle');
                results.oracle = await oracleRepo.create(personData);
            }

            if (target === 'memgraph' || target === 'both') {
                const memgraphRepo = repositoryFactory.getRepository('person', 'memgraph');
                results.memgraph = await memgraphRepo.create(personData);
            }

            res.status(201).json({
                success: true,
                target,
                data: results
            });
        } catch (error) {
            console.error('Fehler beim Erstellen der Person:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });

    return router;
};