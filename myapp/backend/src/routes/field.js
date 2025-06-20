// src/routes/field.js
const express = require('express');
const router = express.Router();

module.exports = repositoryFactory => {
    router.get('/', async (req, res) => {
        try {
            const repo = repositoryFactory.getRepository('field', req.query.source || 'memgraph');
            const list = await repo.findAll(parseInt(req.query.limit) || 100);
            res.json({ success: true, data: list });
        } catch (e) {
            console.error(e);
            res.status(500).json({ success: false, error: e.message });
        }
    });

    router.get('/:id', async (req, res) => {
        try {
            const repo = repositoryFactory.getRepository('field', req.query.source || 'memgraph');
            const item = await repo.findById(req.params.id);
            res.json({ success: true, data: item });
        } catch (e) {
            console.error(e);
            res.status(500).json({ success: false, error: e.message });
        }
    });

    return router;
};
