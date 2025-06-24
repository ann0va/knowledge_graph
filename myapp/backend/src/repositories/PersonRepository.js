// src/repositories/PersonRepository.js - Fixed für Property Graph
const BaseRepository = require('./BaseRepository');

class PersonRepository extends BaseRepository {
    constructor(db, dbType) {
        super(db, dbType);
        // Fix: Unterschiedliche Label-Conventions
        this.nodeLabel = dbType === 'oracle' ? 'PERSON' : 'person';
    }

    // Alle Personen abrufen - Moderne PGQL Syntax
    async findAll(limit = 100) {
        const queries = {
            oracle: `SELECT id(p) as vertex_id,
                            p.name,
                            p.birth_date,
                            p.death_date,
                            p.gender,
                            p.description
                     FROM MATCH (p:PERSON) ON ${this.defaultGraph}
                         LIMIT ${limit}`,
            memgraph: `MATCH (p:person)
                      RETURN id(p) as vertex_id,
                             p.id as entity_id,
                             p.name,
                             p.birth_date,
                             p.death_date,
                             p.gender,
                             p.description
                      LIMIT $limit`
        };

        return await this.execute(queries, { limit: parseInt(limit) });
    }

    // Person nach ID suchen
    async findById(entityId) {
        const queries = {
            oracle: `SELECT id(p) as vertex_id,
                            p.name,
                            p.birth_date,
                            p.death_date,
                            p.gender,
                            p.description
                     FROM MATCH (p:PERSON) ON ${this.defaultGraph}
                     WHERE id(p) = '${entityId}'`,
            memgraph: `MATCH (p:person {id: $entityId})
                      RETURN id(p) as vertex_id,
                             p.id as entity_id,
                             p.name,
                             p.birth_date,
                             p.death_date,
                             p.gender,
                             p.description`
        };

        const result = await this.execute(queries, { entityId });
        return Array.isArray(result) ? result[0] : result;
    }

    // Beziehungen einer Person abrufen
    async getRelationships(entityId) {
        const queries = {
            oracle: `SELECT label(e) as relationship_type,
                            id(target) as target_vertex_id,
                            label(target) as target_type,
                            target.name as target_name
                     FROM MATCH (p:PERSON)-[e]->(target) ON ${this.defaultGraph}
                     WHERE p.id = '${entityId}'`,
            memgraph: `MATCH (p:person {id: $entityId})-[e]->(target)
                      RETURN type(e) as relationship_type,
                             id(target) as target_vertex_id,
                             labels(target)[0] as target_type,
                             target.name as target_name,
                             target.id as target_entity_id`
        };

        return await this.execute(queries, { entityId });
    }

    // Personen nach Namen suchen
    async searchByName(searchTerm, limit = 20) {
        const queries = {
            oracle: `SELECT id(p) as vertex_id,
                            p.name,
                            p.description
                     FROM MATCH (p:PERSON) ON ${this.defaultGraph}
                     WHERE UPPER(p.name) LIKE UPPER('%${searchTerm}%')
                         LIMIT ${limit}`,
            memgraph: `MATCH (p:person)
                      WHERE toUpper(p.name) CONTAINS toUpper($searchTerm)
                      RETURN id(p) as vertex_id,
                             p.id as entity_id,
                             p.name,
                             p.description
                      LIMIT $limit`
        };

        return await this.execute(queries, { searchTerm, limit: parseInt(limit) });
    }

    // Simple Stats
    async getPersonStats() {
        const queries = {
            oracle: `SELECT COUNT(*) as total_persons
                     FROM MATCH (p:PERSON) ON ${this.defaultGraph}`,
            memgraph: `MATCH (p:person)
                      RETURN COUNT(p) as total_persons`
        };

        const result = await this.execute(queries);
        return Array.isArray(result) ? result[0] : result;
    }
}

module.exports = PersonRepository;