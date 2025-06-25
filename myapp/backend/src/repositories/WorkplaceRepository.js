// src/repositories/WorkplaceRepository.js - PGQL/Cypher Fixed
const BaseRepository = require('./BaseRepository');

class WorkplaceRepository extends BaseRepository {
    constructor(db, dbType) {
        super(db, dbType);
        this.defaultGraph = 'ALL_GRAPH';
    }

    // Alle Arbeitsstätten abrufen
    async findAll(limit = 100) {
        const queries = {
            oracle: `SELECT id(w) as vertex_id, w.name FROM MATCH (w:WORKPLACE) ON ALL_GRAPH LIMIT ${limit}`,
            memgraph: `MATCH (w:workplace) RETURN id(w) as vertex_id, w.name LIMIT $limit`
        };
        // const queries = {
        //     oracle: `SELECT id(w) as vertex_id,
        //                     w.name,
        //                     w.type,
        //                     w.founded,
        //                     w.location
        //              FROM MATCH (w:WORKPLACE) ON ${this.defaultGraph}
        //              LIMIT ${limit}`,
        //     memgraph: `MATCH (w:workplace)
        //               RETURN id(w) as vertex_id,
        //                      w.id as entity_id,
        //                      w.name,
        //                      w.type,
        //                      w.founded,
        //                      w.location
        //               LIMIT $limit`
        // };

        return await this.execute(queries, { limit });
    }

    // Arbeitsstätte nach ID suchen
    async findById(entityId) {
        const queries = {
            oracle: `SELECT id(w) as vertex_id,
                            w.name,
                            w.type,
                            w.founded,
                            w.location
                     FROM MATCH (w:WORKPLACE) ON ${this.defaultGraph}
                     WHERE id(w) = '${entityId}'`,
            memgraph: `MATCH (w:workplace {id: $entityId})
                      RETURN id(w) as vertex_id,
                             w.id as entity_id,
                             w.name,
                             w.type,
                             w.founded,
                             w.location`
        };

        const result = await this.execute(queries, { entityId });
        return Array.isArray(result) ? result[0] : result;
    }

    // Mitarbeiter einer Arbeitsstätte finden
    async getEmployees(workplaceId) {
        const queries = {
            oracle: `SELECT id(employee) as vertex_id,
                            employee.name,
                            employee.birth_date,
                            employee.death_date,
                            employee.gender,
                            employee.description
                     FROM MATCH (employee:PERSON)-[:WORKED_AT]->(workplace:WORKPLACE) ON ${this.defaultGraph}
                     WHERE id(workplace) = '${workplaceId}'`,
            memgraph: `MATCH (employee:person)-[:WORKED_AT]->(workplace:workplace {id: $workplaceId})
                      RETURN id(employee) as vertex_id,
                             employee.id as entity_id,
                             employee.name,
                             employee.birth_date,
                             employee.death_date,
                             employee.gender,
                             employee.description`
        };

        return await this.execute(queries, { workplaceId });
    }

    // Search workplaces by name
    async searchByName(searchTerm, limit = 10) {
        const queries = {
            oracle: `SELECT id(w) as vertex_id,
                            w.name,
                            w.type,
                            w.founded,
                            w.location
                     FROM MATCH (w:WORKPLACE) ON ${this.defaultGraph}
                     WHERE UPPER(w.name) CONTAINS UPPER('${searchTerm}')
                     LIMIT ${limit}`,
            memgraph: `MATCH (w:workplace)
                      WHERE toUpper(w.name) CONTAINS toUpper($searchTerm)
                      RETURN id(w) as vertex_id,
                             w.id as entity_id,
                             w.name,
                             w.type,
                             w.founded,
                             w.location
                      LIMIT $limit`
        };

        return await this.execute(queries, { searchTerm, limit });
    }
}

module.exports = WorkplaceRepository;