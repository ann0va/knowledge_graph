// src/routes/occupation.js - Enhanced with Search & Relations
const express = require('express');
const router = express.Router();

module.exports = repositoryFactory => {
    // GET /api/occupation - List all + Search
    router.get('/', async (req, res) => {
        try {
            const source = req.query.source || 'both';
            const limit = parseInt(req.query.limit) || 100;
            const search = req.query.search;

            if (source === 'both') {
                const [memgraphRepo, oracleRepo] = [
                    repositoryFactory.getRepository('occupation', 'memgraph'),
                    repositoryFactory.getRepository('occupation', 'oracle')
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
                const repo = repositoryFactory.getRepository('occupation', source);
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
            console.error('Occupation list error:', e);
            res.status(500).json({ success: false, error: e.message });
        }
    });

    // GET /api/occupation/:id - Single occupation
    router.get('/:id', async (req, res) => {
        try {
            const source = req.query.source || 'memgraph';
            const repo = repositoryFactory.getRepository('occupation', source);

            const occupation = await repo.findById(req.params.id);

            if (!occupation) {
                return res.status(404).json({
                    success: false,
                    error: 'Occupation not found'
                });
            }

            res.json({
                success: true,
                source,
                data: occupation
            });
        } catch (e) {
            console.error('Occupation get error:', e);
            res.status(500).json({ success: false, error: e.message });
        }
    });

    // GET /api/occupation/:id/people - People with this occupation
    router.get('/:id/people', async (req, res) => {
        try {
            const source = req.query.source || 'memgraph';
            const repo = repositoryFactory.getRepository('occupation', source);

            const people = await repo.getPeopleWithOccupation(req.params.id);

            res.json({
                success: true,
                source,
                occupationId: req.params.id,
                count: people.length,
                data: people
            });
        } catch (e) {
            console.error('Occupation people error:', e);
            res.status(500).json({ success: false, error: e.message });
        }
    });

    return router;
};