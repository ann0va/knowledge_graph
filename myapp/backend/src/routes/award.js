// src/routes/place.js - Enhanced with Search & Relations
const express = require('express');
const router = express.Router();

module.exports = repositoryFactory => {
    // GET /api/place - List all + Search
    router.get('/', async (req, res) => {
        try {
            const source = req.query.source || 'both';
            const limit = parseInt(req.query.limit) || 100;
            const search = req.query.search;

            if (source === 'both') {
                const [memgraphRepo, oracleRepo] = [
                    repositoryFactory.getRepository('place', 'memgraph'),
                    repositoryFactory.getRepository('place', 'oracle')
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
                const repo = repositoryFactory.getRepository('place', source);
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
            console.error('Place list error:', e);
            res.status(500).json({ success: false, error: e.message });
        }
    });

    // GET /api/place/:id - Single place
    router.get('/:id', async (req, res) => {
        try {
            const source = req.query.source || 'memgraph';
            const repo = repositoryFactory.getRepository('place', source);

            const place = await repo.findById(req.params.id);

            if (!place) {
                return res.status(404).json({
                    success: false,
                    error: 'Place not found'
                });
            }

            res.json({
                success: true,
                source,
                data: place
            });
        } catch (e) {
            console.error('Place get error:', e);
            res.status(500).json({ success: false, error: e.message });
        }
    });

    // GET /api/place/:id/people - People born here
    router.get('/:id/people', async (req, res) => {
        try {
            const source = req.query.source || 'memgraph';
            const repo = repositoryFactory.getRepository('place', source);

            const people = await repo.getPeopleBornHere(req.params.id);

            res.json({
                success: true,
                source,
                placeId: req.params.id,
                count: people.length,
                data: people
            });
        } catch (e) {
            console.error('Place people error:', e);
            res.status(500).json({ success: false, error: e.message });
        }
    });

    return router;
};