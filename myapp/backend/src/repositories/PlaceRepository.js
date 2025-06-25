// src/repositories/PlaceRepository.js - PGQL/Cypher Fixed
const BaseRepository = require('./BaseRepository');

class PlaceRepository extends BaseRepository {
    constructor(db, dbType) {
        super(db, dbType);
        this.defaultGraph = 'ALL_GRAPH';
    }

    // Alle Orte abrufen
    async findAll(limit = 100) {
        const queries = {
            oracle: `SELECT id(p) as vertex_id, p.name FROM MATCH (p:PLACE) ON ALL_GRAPH LIMIT ${limit}`,
            memgraph: `MATCH (p:place) RETURN id(p) as vertex_id, p.name LIMIT $limit`
        };
        // const queries = {
        //     oracle: `SELECT id(p) as vertex_id,
        //                     p.name,
        //                     p.type,
        //                     p.country,
        //                     p.coordinates
        //              FROM MATCH (p:PLACE) ON ${this.defaultGraph}
        //              LIMIT ${limit}`,
        //     memgraph: `MATCH (p:place)
        //               RETURN id(p) as vertex_id,
        //                      p.id as entity_id,
        //                      p.name,
        //                      p.type,
        //                      p.country,
        //                      p.coordinates
        //               LIMIT $limit`
        // };

        return await this.execute(queries, { limit });
    }

    // Ort nach ID suchen
    async findById(entityId) {
        const queries = {
            oracle: `SELECT id(p) as vertex_id,
                            p.name,
                            p.type,
                            p.country,
                            p.coordinates
                     FROM MATCH (p:PLACE) ON ${this.defaultGraph}
                     WHERE id(p) = '${entityId}'`,
            memgraph: `MATCH (p:place {id: $entityId})
                      RETURN id(p) as vertex_id,
                             p.id as entity_id,
                             p.name,
                             p.type,
                             p.country,
                             p.coordinates`
        };

        const result = await this.execute(queries, { entityId });
        return Array.isArray(result) ? result[0] : result;
    }

    // Personen die an diesem Ort geboren wurden
    async getPeopleBornHere(placeId) {
        const queries = {
            oracle: `SELECT id(person) as vertex_id,
                            person.name,
                            person.birth_date,
                            person.death_date,
                            person.gender,
                            person.description
                     FROM MATCH (person:PERSON)-[:BIRTH_IN]->(place:PLACE) ON ${this.defaultGraph}
                     WHERE id(place) = '${placeId}'`,
            memgraph: `MATCH (person:person)-[:BIRTH_IN]->(place:place {id: $placeId})
                      RETURN id(person) as vertex_id,
                             person.id as entity_id,
                             person.name,
                             person.birth_date,
                             person.death_date,
                             person.gender,
                             person.description`
        };

        return await this.execute(queries, { placeId });
    }

    // Search places by name
    async searchByName(searchTerm, limit = 10) {
        const queries = {
            oracle: `SELECT id(p) as vertex_id,
                            p.name,
                            p.type,
                            p.country
                     FROM MATCH (p:PLACE) ON ${this.defaultGraph}
                     WHERE UPPER(p.name) CONTAINS UPPER('${searchTerm}')
                     LIMIT ${limit}`,
            memgraph: `MATCH (p:place)
                      WHERE toUpper(p.name) CONTAINS toUpper($searchTerm)
                      RETURN id(p) as vertex_id,
                             p.id as entity_id,
                             p.name,
                             p.type,
                             p.country
                      LIMIT $limit`
        };

        return await this.execute(queries, { searchTerm, limit });
    }
}

module.exports = PlaceRepository;