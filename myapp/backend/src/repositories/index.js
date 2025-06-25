// src/repositories/index.js - Erweitert mit allen neuen Repositories
const PersonRepository = require('./PersonRepository');
const AwardRepository = require('./AwardRepository');
const FieldRepository = require('./FieldRepository');
const PlaceRepository = require('./PlaceRepository');
const WorkRepository = require('./WorkRepository');
const WorkplaceRepository = require('./WorkplaceRepository');
const OccupationRepository = require('./OccupationRepository');

class RepositoryFactory {
    constructor(oracleDb, memgraphDb) {
        this.oracle = oracleDb;
        this.memgraph = memgraphDb;
        this.repositories = new Map();
    }

    getRepository(entityType, dbType = 'memgraph') {
        const key = `${entityType}_${dbType}`;

        if (this.repositories.has(key)) {
            return this.repositories.get(key);
        }

        const db = dbType === 'oracle' ? this.oracle : this.memgraph;
        let repository;

        switch (entityType.toLowerCase()) {
            case 'person':
                repository = new PersonRepository(db, dbType);
                break;
            case 'award':
                repository = new AwardRepository(db, dbType);
                break;
            case 'field':
                repository = new FieldRepository(db, dbType);
                break;
            case 'place':
                repository = new PlaceRepository(db, dbType);
                break;
            case 'work':
                repository = new WorkRepository(db, dbType);
                break;
            case 'workplace':
                repository = new WorkplaceRepository(db, dbType);
                break;
            case 'occupation':
                repository = new OccupationRepository(db, dbType);
                break;
            default:
                throw new Error(`Unknown entity type: ${entityType}`);
        }

        this.repositories.set(key, repository);
        return repository;
    }

    // Alle verfügbaren Entity-Typen
    getAvailableEntityTypes() {
        return [
            'person',
            'award',
            'field',
            'place',
            'work',
            'workplace',
            'occupation'
        ];
    }
}

module.exports = RepositoryFactory;