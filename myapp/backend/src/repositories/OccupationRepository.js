// src/repositories/OccupationRepository.js - PGQL/Cypher Fixed
const BaseRepository = require('./BaseRepository');

class OccupationRepository extends BaseRepository {
    constructor(db, dbType) {
        super(db, dbType);
        this.defaultGraph = 'ALL_GRAPH';
    }

    // Alle Berufe abrufen
    async findAll(limit = 100) {
        const queries = {
            oracle: `SELECT id(o) as vertex_id, o.name FROM MATCH (o:OCCUPATION) ON ALL_GRAPH LIMIT ${limit}`,
            memgraph: `MATCH (o:occupation) RETURN id(o) as vertex_id, o.name LIMIT $limit`
        };
        // const queries = {
        //     oracle: `SELECT id(o) as vertex_id,
        //                     o.name,
        //                     o.description,
        //                     o.category
        //              FROM MATCH (o:OCCUPATION) ON ${this.defaultGraph}
        //              LIMIT ${limit}`,
        //     memgraph: `MATCH (o:occupation)
        //               RETURN id(o) as vertex_id,
        //                      o.id as entity_id,
        //                      o.name,
        //                      o.description,
        //                      o.category
        //               LIMIT $limit`
        // };

        return await this.execute(queries, { limit });
    }

    // Beruf nach ID suchen
    async findById(entityId) {
        const queries = {
            oracle: `SELECT id(o) as vertex_id,
                            o.name,
                            o.description,
                            o.category
                     FROM MATCH (o:OCCUPATION) ON ${this.defaultGraph}
                     WHERE id(o) = '${entityId}'`,
            memgraph: `MATCH (o:occupation {id: $entityId})
                      RETURN id(o) as vertex_id,
                             o.id as entity_id,
                             o.name,
                             o.description,
                             o.category`
        };

        const result = await this.execute(queries, { entityId });
        return Array.isArray(result) ? result[0] : result;
    }

    // Personen mit diesem Beruf finden
    async getPeopleWithOccupation(occupationId) {
        const queries = {
            oracle: `SELECT id(person) as vertex_id,
                            person.name,
                            person.birth_date,
                            person.death_date,
                            person.gender,
                            person.description
                     FROM MATCH (person:PERSON)-[:HAS_OCCUPATION]->(occupation:OCCUPATION) ON ${this.defaultGraph}
                     WHERE id(occupation) = '${occupationId}'`,
            memgraph: `MATCH (person:person)-[:HAS_OCCUPATION]->(occupation:occupation {id: $occupationId})
                      RETURN id(person) as vertex_id,
                             person.id as entity_id,
                             person.name,
                             person.birth_date,
                             person.death_date,
                             person.gender,
                             person.description`
        };

        return await this.execute(queries, { occupationId });
    }

    // Search occupations by name
    async searchByName(searchTerm, limit = 10) {
        const queries = {
            oracle: `SELECT id(o) as vertex_id,
                            o.name,
                            o.description,
                            o.category
                     FROM MATCH (o:OCCUPATION) ON ${this.defaultGraph}
                     WHERE UPPER(o.name) CONTAINS UPPER('${searchTerm}')
                     LIMIT ${limit}`,
            memgraph: `MATCH (o:occupation)
                      WHERE toUpper(o.name) CONTAINS toUpper($searchTerm)
                      RETURN id(o) as vertex_id,
                             o.id as entity_id,
                             o.name,
                             o.description,
                             o.category
                      LIMIT $limit`
        };

        return await this.execute(queries, { searchTerm, limit });
    }
}

module.exports = OccupationRepository;