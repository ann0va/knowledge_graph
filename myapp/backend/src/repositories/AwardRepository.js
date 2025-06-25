// src/repositories/AwardRepository.js - PGQL/Cypher Fixed
const BaseRepository = require('./BaseRepository');

class AwardRepository extends BaseRepository {
    constructor(db, dbType) {
        super(db, dbType);
        this.defaultGraph = 'ALL_GRAPH';
    }

    // Alle Auszeichnungen abrufen
    async findAll(limit = 100) {
        const queries = {
            oracle: `SELECT id(a) as vertex_id, a.name FROM MATCH (a:AWARD) ON ALL_GRAPH LIMIT ${limit}`,
            memgraph: `MATCH (a:award) RETURN id(a) as vertex_id, a.name LIMIT $limit`
        };
        return await this.execute(queries, { limit });
        // const queries = {
        //     oracle: `SELECT id(a) as vertex_id,
        //                     a.name,
        //                     a.description,
        //                     a.year
        //              FROM MATCH (a:AWARD) ON ${this.defaultGraph}
        //              LIMIT ${limit}`,
        //     memgraph: `MATCH (a:award)
        //               RETURN id(a) as vertex_id,
        //                      a.id as entity_id,
        //                      a.name,
        //                      a.description,
        //                      a.year
        //               LIMIT $limit`
        // };
        //
        // return await this.execute(queries, { limit });
    }

    // Auszeichnung nach ID suchen
    async findById(entityId) {
        const queries = {
            oracle: `SELECT id(a) as vertex_id,
                            a.name,
                            a.description,
                            a.year
                     FROM MATCH (a:AWARD) ON ${this.defaultGraph}
                     WHERE id(a) = '${entityId}'`,
            memgraph: `MATCH (a:award {id: $entityId})
                      RETURN id(a) as vertex_id,
                             a.id as entity_id,
                             a.name,
                             a.description,
                             a.year`
        };

        const result = await this.execute(queries, { entityId });
        return Array.isArray(result) ? result[0] : result;
    }

    // Empfänger einer Auszeichnung finden
    async getRecipients(awardId) {
        const queries = {
            oracle: `SELECT id(p) as vertex_id,
                            p.name,
                            p.birth_date,
                            p.death_date,
                            p.gender
                     FROM MATCH (p:PERSON)-[:RECEIVED]->(a:AWARD) ON ${this.defaultGraph}
                     WHERE id(a) = '${awardId}'`,
            memgraph: `MATCH (p:person)-[:RECEIVED]->(a:award {id: $awardId})
                      RETURN id(p) as vertex_id,
                             p.id as entity_id,
                             p.name,
                             p.birth_date,
                             p.death_date,
                             p.gender`
        };

        return await this.execute(queries, { awardId });
    }

    // Search awards by name
    async searchByName(searchTerm, limit = 10) {
        const queries = {
            oracle: `SELECT id(a) as vertex_id,
                            a.name,
                            a.description,
                            a.year
                     FROM MATCH (a:AWARD) ON ${this.defaultGraph}
                     WHERE UPPER(a.name) CONTAINS UPPER('${searchTerm}')
                     LIMIT ${limit}`,
            memgraph: `MATCH (a:award)
                      WHERE toUpper(a.name) CONTAINS toUpper($searchTerm)
                      RETURN id(a) as vertex_id,
                             a.id as entity_id,
                             a.name,
                             a.description,
                             a.year
                      LIMIT $limit`
        };

        return await this.execute(queries, { searchTerm, limit });
    }
}

module.exports = AwardRepository;