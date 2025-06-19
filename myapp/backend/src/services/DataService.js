
// src/services/DataService.js
const { OracleRepository, MemgraphRepository } = require('../repositories');

class DataService {
    constructor() {
        this.repositories = {
            oracle: null,
            memgraph: null
        };
    }

    setEntity(entityName) {
        this.repositories.oracle = new OracleRepository(entityName);
        this.repositories.memgraph = new MemgraphRepository(entityName);
    }

    getRepository(dbType) {
        const repo = this.repositories[dbType];
        if (!repo) {
            throw new Error(`Repository für ${dbType} nicht gefunden`);
        }
        return repo;
    }

    async create(dbType, data) {
        const repository = this.getRepository(dbType);
        return await repository.create(data);
    }

    async read(dbType, query) {
        const repository = this.getRepository(dbType);
        return await repository.read(query);
    }

    async update(dbType, id, data) {
        const repository = this.getRepository(dbType);
        return await repository.update(id, data);
    }

    async delete(dbType, id) {
        const repository = this.getRepository(dbType);
        return await repository.delete(id);
    }

    async executeQuery(dbType, query) {
        const repository = this.getRepository(dbType);
        return await repository.executeQuery(query);
    }

    // Unified query interface - übersetzt generische Anfragen in DB-spezifische
    async unifiedQuery(dbType, operation, params) {
        switch (operation) {
            case 'create':
                return await this.create(dbType, params.data);
            case 'read':
                return await this.read(dbType, params.query || {});
            case 'update':
                return await this.update(dbType, params.id, params.data);
            case 'delete':
                return await this.delete(dbType, params.id);
            case 'query':
                return await this.executeQuery(dbType, params.query);
            default:
                throw new Error(`Unbekannte Operation: ${operation}`);
        }
    }
}

module.exports = DataService;