// src/controllers/DataController.js
const DataService = require('../services/DataService');

class DataController {
    constructor() {
        this.dataService = new DataService();
    }

    // CRUD Endpunkte
    async create(req, res, next) {
        try {
            const { entity, dbType = 'oracle', data } = req.body;

            if (!entity || !data) {
                return res.status(400).json({
                    error: 'Entity und Data sind erforderlich'
                });
            }

            this.dataService.setEntity(entity);
            const result = await this.dataService.create(dbType, data);

            res.status(201).json({
                success: true,
                data: result,
                database: dbType
            });
        } catch (error) {
            next(error);
        }
    }

    async read(req, res, next) {
        try {
            const { entity, dbType = 'oracle' } = req.query;
            const query = req.body || {};

            if (!entity) {
                return res.status(400).json({
                    error: 'Entity ist erforderlich'
                });
            }

            this.dataService.setEntity(entity);
            const result = await this.dataService.read(dbType, query);

            res.json({
                success: true,
                data: result,
                database: dbType,
                count: result.length
            });
        } catch (error) {
            next(error);
        }
    }

    async update(req, res, next) {
        try {
            const { id } = req.params;
            const { entity, dbType = 'oracle', data } = req.body;

            if (!entity || !data) {
                return res.status(400).json({
                    error: 'Entity und Data sind erforderlich'
                });
            }

            this.dataService.setEntity(entity);
            const result = await this.dataService.update(dbType, id, data);

            res.json({
                success: true,
                data: result,
                database: dbType
            });
        } catch (error) {
            next(error);
        }
    }

    async delete(req, res, next) {
        try {
            const { id } = req.params;
            const { entity, dbType = 'oracle' } = req.body;

            if (!entity) {
                return res.status(400).json({
                    error: 'Entity ist erforderlich'
                });
            }

            this.dataService.setEntity(entity);
            const result = await this.dataService.delete(dbType, id);

            res.json({
                success: true,
                data: result,
                database: dbType
            });
        } catch (error) {
            next(error);
        }
    }

    // Universelle Query-Schnittstelle
    async query(req, res, next) {
        try {
            const { entity, dbType = 'oracle', operation, params } = req.body;

            if (!entity || !operation) {
                return res.status(400).json({
                    error: 'Entity und Operation sind erforderlich'
                });
            }

            this.dataService.setEntity(entity);
            const result = await this.dataService.unifiedQuery(dbType, operation, params);

            res.json({
                success: true,
                data: result,
                database: dbType,
                operation
            });
        } catch (error) {
            next(error);
        }
    }

    // Direkte Query-Ausführung
    async executeQuery(req, res, next) {
        try {
            const { dbType = 'oracle', query } = req.body;

            if (!query) {
                return res.status(400).json({
                    error: 'Query ist erforderlich'
                });
            }

            const result = await this.dataService.executeQuery(dbType, query);

            res.json({
                success: true,
                data: result,
                database: dbType
            });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = DataController;