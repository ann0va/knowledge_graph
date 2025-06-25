// src/routes/workplace.js - Enhanced with Search & Relations
const express = require('express');
const router = express.Router();

module.exports = repositoryFactory => {
    // GET /api/workplace - List all + Search
    router.get('/', async (req, res) => {
        try {
            const source = req.query.source || 'both';
            const limit = parseInt(req.query.limit) || 100;
            const search = req.query.search;

            if (source === 'both') {
                const [memgraphRepo, oracleRepo] = [
                    repositoryFactory.getRepository('workplace', 'memgraph'),
                    repositoryFactory.getRepository('workplace', 'oracle')
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
                const repo = repositoryFactory.getRepository('workplace', source);
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
            console.error('Workplace list error:', e);
            res.status(500).json({ success: false, error: e.message });
        }
    });

    // GET /api/workplace/:id - Single workplace
    router.get('/:id', async (req, res) => {
        try {
            const source = req.query.source || 'memgraph';
            const repo = repositoryFactory.getRepository('workplace', source);

            const workplace = await repo.findById(req.params.id);

            if (!workplace) {
                return res.status(404).json({
                    success: false,
                    error: 'Workplace not found'
                });
            }

            res.json({
                success: true,
                source,
                data: workplace
            });
        } catch (e) {
            console.error('Workplace get error:', e);
            res.status(500).json({ success: false, error: e.message });
        }
    });

    // GET /api/workplace/:id/employees - Workplace employees
    router.get('/:id/employees', async (req, res) => {
        try {
            const source = req.query.source || 'memgraph';
            const repo = repositoryFactory.getRepository('workplace', source);

            const employees = await repo.getEmployees(req.params.id);

            res.json({
                success: true,
                source,
                workplaceId: req.params.id,
                count: employees.length,
                data: employees
            });
        } catch (e) {
            console.error('Workplace employees error:', e);
            res.status(500).json({ success: false, error: e.message });
        }
    });

    return router;
};