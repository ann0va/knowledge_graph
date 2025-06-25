// src/routes/field.js - Enhanced with Search & Relations
const express = require('express');
const router = express.Router();

module.exports = repositoryFactory => {
    // GET /api/field - List all + Search
    router.get('/', async (req, res) => {
        try {
            const source = req.query.source || 'both';
            const limit = parseInt(req.query.limit) || 100;
            const search = req.query.search;

            if (source === 'both') {
                const [memgraphRepo, oracleRepo] = [
                    repositoryFactory.getRepository('field', 'memgraph'),
                    repositoryFactory.getRepository('field', 'oracle')
                ];

                const [memgraphData, oracleData] = await Promise.allSettled([
                    search ? memgraphRepo.searchByName(search, limit) : memgraphRepo.findAll(limit),
                    search ? oracleRepo.searchByName(search, limit) : oracleRepo.findAll(limit)
                ]);

                res.json({
                    success: true,
                    source: 'both',
                    data: {
                        memgraph: memgraphData.status === 'fulfilled' ? memgraphData.value : [],
                        oracle: oracleData.status === 'fulfilled' ? oracleData.value : []
                    }
                });
            } else {
                const repo = repositoryFactory.getRepository('field', source);
                const data = search
                    ? await repo.searchByName(search, limit)
                    : await repo.findAll(limit);

                res.json({
                    success: true,
                    source,
                    count: data.length,
                    data
                });
            }
        } catch (e) {
            console.error('Field list error:', e);
            res.status(500).json({ success: false, error: e.message });
        }
    });

    // GET /api/field/:id - Single field
    router.get('/:id', async (req, res) => {
        try {
            const source = req.query.source || 'memgraph';
            const repo = repositoryFactory.getRepository('field', source);

            const field = await repo.findById(req.params.id);

            if (!field) {
                return res.status(404).json({
                    success: false,
                    error: 'Field not found'
                });
            }

            res.json({
                success: true,
                source,
                data: field
            });
        } catch (e) {
            console.error('Field get error:', e);
            res.status(500).json({ success: false, error: e.message });
        }
    });

    // GET /api/field/:id/people - People in this field
    router.get('/:id/people', async (req, res) => {
        try {
            const source = req.query.source || 'memgraph';
            const repo = repositoryFactory.getRepository('field', source);

            const people = await repo.getPeopleInField(req.params.id);

            res.json({
                success: true,
                source,
                fieldId: req.params.id,
                count: people.length,
                data: people
            });
        } catch (e) {
            console.error('Field people error:', e);
            res.status(500).json({ success: false, error: e.message });
        }
    });

    return router;
};