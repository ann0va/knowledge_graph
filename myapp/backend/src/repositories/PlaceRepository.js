// src/repositories/PlaceRepository.js
const BaseRepository = require('./BaseRepository');

class PlaceRepository extends BaseRepository {
    constructor(db, dbType) {
        super(db, dbType);
    }

    // Alle Orte abrufen
    async findAll(limit = 100) {
        const queries = {
            oracle: `
        SELECT v.vertex_id as id, v.properties
        FROM GRAPH_TABLE (knowledge_graph
          MATCH (v)
          WHERE v.vertex_type = 'PLACE'
          COLUMNS (v.vertex_id, v.properties)
        )
        FETCH FIRST ${limit} ROWS ONLY
      `,
            memgraph: `
        MATCH (p:Place) 
        RETURN p 
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

    // Ort nach ID suchen
    async findById(id) {
        const queries = {
            oracle: `
        SELECT v.vertex_id as id, v.properties
        FROM GRAPH_TABLE (knowledge_graph
          MATCH (v)
          WHERE v.vertex_type = 'PLACE' 
            AND v.vertex_id = :id
          COLUMNS (v.vertex_id, v.properties)
        )
      `,
            memgraph: `
        MATCH (p:Place {id: $id}) 
        RETURN p
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

    // Personen die an diesem Ort geboren wurden
    async getPeopleBornHere(placeId) {
        const queries = {
            oracle: `
        SELECT 
          s.vertex_id as person_id,
          s.properties as person_properties
        FROM GRAPH_TABLE (knowledge_graph
          MATCH (s)-[e]->(t)
          WHERE t.vertex_type = 'PLACE' 
            AND t.vertex_id = :placeId
            AND e.edge_label = 'BIRTH_IN'
          COLUMNS (s.vertex_id, s.properties)
        )
      `,
            memgraph: `
        MATCH (person:Person)-[:BIRTH_IN]->(place:Place {id: $placeId})
        RETURN person
      `
        };

        const params = this.dbType === 'oracle' ? { placeId } : { placeId };
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

    // Neuen Ort erstellen
    async create(placeData) {
        const id = placeData.id || `place_${Date.now()}`;
        const properties = {
            id,
            name: placeData.name,
            type: placeData.type || 'Place'
        };

        const queries = {
            oracle: `
        INSERT INTO kg_vertices (vertex_id, vertex_type, properties)
        VALUES (:id, 'PLACE', :props)
      `,
            memgraph: `
        CREATE (p:Place $props)
        RETURN p
      `
        };

        const params = this.dbType === 'oracle'
            ? { id, props: JSON.stringify(properties) }
            : { props: properties };

        await this.execute(queries, params);
        return properties;
    }
}

module.exports = PlaceRepository;