// src/repositories/index.js - NEUE VERSION mit EntityRepository
const EntityRepository = require('./EntityRepository');

class RepositoryFactory {
    constructor(oracleDb, memgraphDb) {
        this.oracle = oracleDb;
        this.memgraph = memgraphDb;
        this.repositories = new Map();
    }

    // 🎯 MAIN: Repository für Entity-Type abrufen (NEUE METHODE)
    getRepository(entityType, dbType = 'memgraph') {
        // Validierung
        if (!EntityRepository.getAvailableEntityTypes().includes(entityType)) {
            throw new Error(`Unknown entity type: ${entityType}. Available: ${EntityRepository.getAvailableEntityTypes().join(', ')}`);
        }

        const key = `${entityType}_${dbType}`;

        // Cache nutzen
        if (this.repositories.has(key)) {
            return this.repositories.get(key);
        }

        // Repository erstellen
        const db = dbType === 'oracle' ? this.oracle : this.memgraph;
        const repository = new EntityRepository(db, dbType, entityType);

        // Cachen und zurückgeben
        this.repositories.set(key, repository);
        return repository;
    }

    // 🎯 CONVENIENCE: Alle Repositories für einen DB-Type erstellen
    getAllRepositories(dbType = 'memgraph') {
        const repositories = {};

        for (const entityType of EntityRepository.getAvailableEntityTypes()) {
            repositories[entityType] = this.getRepository(entityType, dbType);
        }

        return repositories;
    }

    // 🎯 UTILITY: Verfügbare Entity-Typen
    getAvailableEntityTypes() {
        return EntityRepository.getAvailableEntityTypes();
    }

    // 🎯 UTILITY: Entity-Konfiguration abrufen
    getEntityConfig(entityType) {
        return EntityRepository.getEntityConfig(entityType);
    }

    // 🎯 UTILITY: Alle verfügbaren Relationship-Typen
    getAvailableRelationshipTypes() {
        return EntityRepository.getAvailableRelationshipTypes();
    }

    // 🎯 CLEANUP: Alle Repositories schließen
    async closeAll() {
        for (const repository of this.repositories.values()) {
            if (repository.close) {
                await repository.close();
            }
        }
        this.repositories.clear();
    }

    // 🎯 HEALTH: Alle Repositories testen
    async healthCheckAll() {
        const results = {};

        for (const entityType of this.getAvailableEntityTypes()) {
            try {
                const memgraphRepo = this.getRepository(entityType, 'memgraph');
                const oracleRepo = this.getRepository(entityType, 'oracle');

                results[entityType] = {
                    memgraph: await memgraphRepo.healthCheck(),
                    oracle: await oracleRepo.healthCheck()
                };
            } catch (error) {
                results[entityType] = {
                    error: error.message
                };
            }
        }

        return results;
    }
}

module.exports = RepositoryFactory;