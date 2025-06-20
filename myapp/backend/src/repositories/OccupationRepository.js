// src/repositories/OccupationRepository.js
const BaseRepository = require('./BaseRepository');

class OccupationRepository extends BaseRepository {
    constructor(db, dbType) {
        super(db, dbType);
    }

    // Alle Berufe abrufen
    async findAll(limit = 100) {
        const queries = {
            oracle: `
        SELECT v.vertex_id as id, v.properties
        FROM GRAPH_TABLE (knowledge_graph
          MATCH (v)
          WHERE v.vertex_type = 'OCCUPATION'
          COLUMNS (v.vertex_id, v.properties)
        )
        FETCH FIRST ${limit} ROWS ONLY
      `,
            memgraph: `
        MATCH (o:Occupation) 
        RETURN o 
        LIMIT ${limit}
      `
        };

        const result = await this.execute(queries);

        if (this.dbType === 'oracle' && result.rows) {
            return result.rows.map(row => {
                const props = JSON.parse(row[1]);
                return {
                    id: row[0],
                    ...props
                };
            });
        }

        return result;
    }

    // Beruf nach ID suchen
    async findById(id) {
        const queries = {
            oracle: `
        SELECT v.vertex_id as id, v.properties
        FROM GRAPH_TABLE (knowledge_graph
          MATCH (v)
          WHERE v.vertex_type = 'OCCUPATION' 
            AND v.vertex_id = :id
          COLUMNS (v.vertex_id, v.properties)
        )
      `,
            memgraph: `
        MATCH (o:Occupation {id: $id}) 
        RETURN o
      `
        };

        const params = this.dbType === 'oracle' ? { id } : { id };
        const result = await this.execute(queries, params);

        if (this.dbType === 'oracle' && result.rows && result.rows.length > 0) {
            const props = JSON.parse(result.rows[0][1]);
            return {
                id: result.rows[0][0],
                ...props
            };
        }

        return result?.[0] || null;
    }

    // Personen mit diesem Beruf finden
    async getPeopleWithOccupation(occupationId) {
        const queries = {
            oracle: `
        SELECT 
          s.vertex_id as person_id,
          s.properties as person_properties
        FROM GRAPH_TABLE (knowledge_graph
          MATCH (s)-[e]->(t)
          WHERE t.vertex_type = 'OCCUPATION' 
            AND t.vertex_id = :occupationId
            AND e.edge_label = 'HAS_OCCUPATION'
          COLUMNS (s.vertex_id, s.properties)
        )
      `,
            memgraph: `
        MATCH (person:Person)-[:HAS_OCCUPATION]->(occupation:Occupation {id: $occupationId})
        RETURN person
      `
        };

        const params = this.dbType === 'oracle' ? { occupationId } : { occupationId };
        const result = await this.execute(queries, params);

        if (this.dbType === 'oracle' && result.rows) {
            return result.rows.map(row => {
                const props = JSON.parse(row[1]);
                return {
                    id: row[0],
                    ...props
                };
            });
        }

        return result;
    }

    // Neuen Beruf erstellen
    async create(occupationData) {
        const id = occupationData.id || `occupation_${Date.now()}`;
        const properties = {
            id,
            name: occupationData.name
        };

        const queries = {
            oracle: `
        INSERT INTO kg_vertices (vertex_id, vertex_type, properties)
        VALUES (:id, 'OCCUPATION', :props)
      `,
            memgraph: `
        CREATE (o:Occupation $props)
        RETURN o
      `
        };

        const params = this.dbType === 'oracle'
            ? { id, props: JSON.stringify(properties) }
            : { props: properties };

        await this.execute(queries, params);
        return properties;
    }
}

module.exports = OccupationRepository;