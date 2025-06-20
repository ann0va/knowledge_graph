// src/repositories/index.js - Zentrale Repository Factory
const PersonRepository = require('./PersonRepository');
const PlaceRepository = require('./PlaceRepository');
const WorkRepository = require('./WorkRepository');
const AwardRepository = require('./AwardRepository');
const WorkplaceRepository = require('./WorkplaceRepository');
const FieldRepository = require('./FieldRepository');
const OccupationRepository = require('./OccupationRepository');

class RepositoryFactory {
    constructor(oracleDb, memgraphDb) {
        this.repositories = {
            oracle: {
                person: new PersonRepository(oracleDb, 'oracle'),
                place: new PlaceRepository(oracleDb, 'oracle'),
                work: new WorkRepository(oracleDb, 'oracle'),
                award: new AwardRepository(oracleDb, 'oracle'),
                workplace: new WorkplaceRepository(oracleDb, 'oracle'),
                field: new FieldRepository(oracleDb, 'oracle'),
                occupation: new OccupationRepository(oracleDb, 'oracle')
            },
            memgraph: {
                person: new PersonRepository(memgraphDb, 'memgraph'),
                place: new PlaceRepository(memgraphDb, 'memgraph'),
                work: new WorkRepository(memgraphDb, 'memgraph'),
                award: new AwardRepository(memgraphDb, 'memgraph'),
                workplace: new WorkplaceRepository(memgraphDb, 'memgraph'),
                field: new FieldRepository(memgraphDb, 'memgraph'),
                occupation: new OccupationRepository(memgraphDb, 'memgraph')
            }
        };
    }

    // Repository für eine bestimmte Datenbank abrufen
    getRepository(entityType, dbType) {
        if (!this.repositories[dbType]) {
            throw new Error(`Unbekannter Datenbanktyp: ${dbType}`);
        }

        if (!this.repositories[dbType][entityType]) {
            throw new Error(`Unbekannter Entity-Typ: ${entityType}`);
        }

        return this.repositories[dbType][entityType];
    }

    // Alle Repositories für eine Datenbank
    getAllRepositories(dbType) {
        if (!this.repositories[dbType]) {
            throw new Error(`Unbekannter Datenbanktyp: ${dbType}`);
        }

        return this.repositories[dbType];
    }

    // Beide Repositories für einen Entity-Typ
    getBothRepositories(entityType) {
        return {
            oracle: this.getRepository(entityType, 'oracle'),
            memgraph: this.getRepository(entityType, 'memgraph')
        };
    }
}

module.exports = RepositoryFactory;