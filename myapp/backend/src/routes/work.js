// src/routes/work.js - Enhanced with Search & Relations
const express = require('express');
const router = express.Router();

module.exports = repositoryFactory => {
    // GET /api/work - List all + Search
    router.get('/', async (req, res) => {
        try {
            const source = req.query.source || 'both';
            const limit = parseInt(req.query.limit) || 100;
            const search = req.query.search;

            if (source === 'both') {
                const [memgraphRepo, oracleRepo] = [
                    repositoryFactory.getRepository('work', 'memgraph'),
                    repositoryFactory.getRepository('work', 'oracle')
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
                const repo = repositoryFactory.getRepository('work', source);
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
            console.error('Work list error:', e);
            res.status(500).json({ success: false, error: e.message });
        }
    });

    // GET /api/work/:id - Single work
    router.get('/:id', async (req, res) => {
        try {
            const source = req.query.source || 'memgraph';
            const repo = repositoryFactory.getRepository('work', source);

            const work = await repo.findById(req.params.id);

            if (!work) {
                return res.status(404).json({
                    success: false,
                    error: 'Work not found'
                });
            }

            res.json({
                success: true,
                source,
                data: work
            });
        } catch (e) {
            console.error('Work get error:', e);
            res.status(500).json({ success: false, error: e.message });
        }
    });

    // GET /api/work/:id/creators - Work creators
    router.get('/:id/creators', async (req, res) => {
        try {
            const source = req.query.source || 'memgraph';
            const repo = repositoryFactory.getRepository('work', source);

            const creators = await repo.getCreators(req.params.id);

            res.json({
                success: true,
                source,
                workId: req.params.id,
                count: creators.length,
                data: creators
            });
        } catch (e) {
            console.error('Work creators error:', e);
            res.status(500).json({ success: false, error: e.message });
        }
    });

    return router;
};