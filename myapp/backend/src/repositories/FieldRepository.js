// src/repositories/FieldRepository.js - PGQL/Cypher Fixed
const BaseRepository = require('./BaseRepository');

class FieldRepository extends BaseRepository {
    constructor(db, dbType) {
        super(db, dbType);
        this.defaultGraph = 'ALL_GRAPH';
    }

    // Alle Fachgebiete abrufen
    async findAll(limit = 100) {
        const queries = {
            oracle: `SELECT id(f) as vertex_id, f.name FROM MATCH (f:FIELD) ON ALL_GRAPH LIMIT ${limit}`,
            memgraph: `MATCH (f:field) RETURN id(f) as vertex_id, f.name LIMIT $limit`
        };
        // const queries = {
        //     oracle: `SELECT id(f) as vertex_id,
        //                     f.name,
        //                     f.description
        //              FROM MATCH (f:FIELD) ON ${this.defaultGraph}
        //              LIMIT ${limit}`,
        //     memgraph: `MATCH (f:field)
        //               RETURN id(f) as vertex_id,
        //                      f.id as entity_id,
        //                      f.name,
        //                      f.description
        //               LIMIT $limit`
        // };

        return await this.execute(queries, { limit });
    }

    // Fachgebiet nach ID suchen
    async findById(entityId) {
        const queries = {
            oracle: `SELECT id(f) as vertex_id,
                            f.name,
                            f.description
                     FROM MATCH (f:FIELD) ON ${this.defaultGraph}
                     WHERE id(f) = '${entityId}'`,
            memgraph: `MATCH (f:field {id: $entityId})
                      RETURN id(f) as vertex_id,
                             f.id as entity_id,
                             f.name,
                             f.description`
        };

        const result = await this.execute(queries, { entityId });
        return Array.isArray(result) ? result[0] : result;
    }

    // Personen die in diesem Fachgebiet arbeiten
    async getPeopleInField(fieldId) {
        const queries = {
            oracle: `SELECT id(p) as vertex_id,
                            p.name,
                            p.birth_date,
                            p.death_date,
                            p.gender,
                            p.description
                     FROM MATCH (p:PERSON)-[:WORKS_IN]->(f:FIELD) ON ${this.defaultGraph}
                     WHERE id(f) = '${fieldId}'`,
            memgraph: `MATCH (p:person)-[:WORKS_IN]->(f:field {id: $fieldId})
                      RETURN id(p) as vertex_id,
                             p.id as entity_id,
                             p.name,
                             p.birth_date,
                             p.death_date,
                             p.gender,
                             p.description`
        };

        return await this.execute(queries, { fieldId });
    }

    // Search fields by name
    async searchByName(searchTerm, limit = 10) {
        const queries = {
            oracle: `SELECT id(f) as vertex_id,
                            f.name,
                            f.description
                     FROM MATCH (f:FIELD) ON ${this.defaultGraph}
                     WHERE UPPER(f.name) CONTAINS UPPER('${searchTerm}')
                     LIMIT ${limit}`,
            memgraph: `MATCH (f:field)
                      WHERE toUpper(f.name) CONTAINS toUpper($searchTerm)
                      RETURN id(f) as vertex_id,
                             f.id as entity_id,
                             f.name,
                             f.description
                      LIMIT $limit`
        };

        return await this.execute(queries, { searchTerm, limit });
    }
}

module.exports = FieldRepository;