// src/repositories/RepositoryFactory.js
const EntityRepository = require('./EntityRepository');

class RepositoryFactory {
    constructor(oracleDb, memgraphDb) {
        this.oracle = oracleDb;
        this.memgraph = memgraphDb;
        this.repositories = new Map();
    }

    // 🎯 MAIN: Repository für Entity-Type abrufen
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

    

    // 🎯 UTILITY: Verfügbare Entity-Typen
    getAvailableEntityTypes() {
        return EntityRepository.getAvailableEntityTypes();
    }

    // 🎯 UTILITY: Alle verfügbaren Relationship-Typen
    getAvailableRelationshipTypes() {
        return EntityRepository.getAvailableRelationshipTypes();
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