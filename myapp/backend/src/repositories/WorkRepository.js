// src/repositories/WorkRepository.js - PGQL/Cypher Fixed
const BaseRepository = require('./BaseRepository');

class WorkRepository extends BaseRepository {
    constructor(db, dbType) {
        super(db, dbType);
        this.defaultGraph = 'ALL_GRAPH';
    }

    // Alle Werke abrufen
    async findAll(limit = 100) {
        const queries = {
            oracle: `SELECT id(w) as vertex_id, w.name FROM MATCH (w:WORK) ON ALL_GRAPH LIMIT ${limit}`,
            memgraph: `MATCH (w:work) RETURN id(w) as vertex_id, w.name LIMIT $limit`
        };
        /*const queries = {
            oracle: `SELECT id(w) as vertex_id,
                            w.name,
                            w.type,
                            w.year,
                            w.description
                     FROM MATCH (w:WORK) ON ${this.defaultGraph}
                     LIMIT ${limit}`,
            memgraph: `MATCH (w:work)
                      RETURN id(w) as vertex_id,
                             w.id as entity_id,
                             w.name,
                             w.type,
                             w.year,
                             w.description
                      LIMIT $limit`
        };*/

        return await this.execute(queries, { limit });
    }

    // Werk nach ID suchen
    async findById(entityId) {
        const queries = {
            oracle: `SELECT id(w) as vertex_id,
                            w.name,
                            w.type,
                            w.year,
                            w.description
                     FROM MATCH (w:WORK) ON ${this.defaultGraph}
                     WHERE id(w) = '${entityId}'`,
            memgraph: `MATCH (w:work {id: $entityId})
                      RETURN id(w) as vertex_id,
                             w.id as entity_id,
                             w.name,
                             w.type,
                             w.year,
                             w.description`
        };

        const result = await this.execute(queries, { entityId });
        return Array.isArray(result) ? result[0] : result;
    }

    // Schöpfer eines Werks finden
    async getCreators(workId) {
        const queries = {
            oracle: `SELECT id(creator) as vertex_id,
                            creator.name,
                            creator.birth_date,
                            creator.death_date,
                            creator.gender,
                            creator.description
                     FROM MATCH (creator:PERSON)-[:CREATED]->(work:WORK) ON ${this.defaultGraph}
                     WHERE id(work) = '${workId}'`,
            memgraph: `MATCH (creator:person)-[:CREATED]->(work:work {id: $workId})
                      RETURN id(creator) as vertex_id,
                             creator.id as entity_id,
                             creator.name,
                             creator.birth_date,
                             creator.death_date,
                             creator.gender,
                             creator.description`
        };

        return await this.execute(queries, { workId });
    }

    // Search works by name
    async searchByName(searchTerm, limit = 10) {
        const queries = {
            oracle: `SELECT id(w) as vertex_id,
                            w.name,
                            w.type,
                            w.year,
                            w.description
                     FROM MATCH (w:WORK) ON ${this.defaultGraph}
                     WHERE UPPER(w.name) CONTAINS UPPER('${searchTerm}')
                     LIMIT ${limit}`,
            memgraph: `MATCH (w:work)
                      WHERE toUpper(w.name) CONTAINS toUpper($searchTerm)
                      RETURN id(w) as vertex_id,
                             w.id as entity_id,
                             w.name,
                             w.type,
                             w.year,
                             w.description
                      LIMIT $limit`
        };

        return await this.execute(queries, { searchTerm, limit });
    }
}

module.exports = WorkRepository;