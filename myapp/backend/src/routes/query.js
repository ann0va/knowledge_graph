// src/routes/query.js
const express = require('express');
const router = express.Router();

module.exports = repositoryFactory => {
    /**
     * POST /api/query
     * Body erwartet:
     * {
     *   source: 'oracle' | 'memgraph',
     *   query: string,
     *   params?: object
     * }
     */
    router.post('/', async (req, res) => {
        const { source, query, params = {} } = req.body;
        if (!source || !query) {
            return res.status(400).json({
                success: false,
                error: 'Bitte "source" und "query" im Body angeben'
            });
        }

        try {
            const repo = repositoryFactory.getRepository(
                /* label irrelevant hier */ null,
                source
            );
            // Nutze executeQuery (Memgraph) oder execute (Oracle) je nach Quelle
            let result;
            if (source === 'memgraph') {
                result = await repo.executeQuery(query);
            } else if (source === 'oracle') {
                // execute erwartet ein Objekt mit key=source, value=query
                const queries = { oracle: query };
                result = await repo.execute(queries, params);
            } else {
                throw new Error(`Unbekannte Quelle: ${source}`);
            }

            res.json({ success: true, source, result });
        } catch (error) {
            console.error('Fehler bei direkter Query:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    return router;
};
