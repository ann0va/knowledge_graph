// src/repositories/WorkRepository.js
const BaseRepository = require('./BaseRepository');

class WorkRepository extends BaseRepository {
    constructor(db, dbType) {
        super(db, dbType);
    }

    // Alle Werke abrufen
    async findAll(limit = 100) {
        const queries = {
            oracle: `
        SELECT v.vertex_id as id, v.properties
        FROM GRAPH_TABLE (knowledge_graph
          MATCH (v)
          WHERE v.vertex_type = 'WORK'
          COLUMNS (v.vertex_id, v.properties)
        )
        FETCH FIRST ${limit} ROWS ONLY
      `,
            memgraph: `
        MATCH (w:Work) 
        RETURN w 
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

    // Werk nach ID suchen
    async findById(id) {
        const queries = {
            oracle: `
        SELECT v.vertex_id as id, v.properties
        FROM GRAPH_TABLE (knowledge_graph
          MATCH (v)
          WHERE v.vertex_type = 'WORK' 
            AND v.vertex_id = :id
          COLUMNS (v.vertex_id, v.properties)
        )
      `,
            memgraph: `
        MATCH (w:Work {id: $id}) 
        RETURN w
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

    // Schöpfer eines Werks finden
    async getCreators(workId) {
        const queries = {
            oracle: `
        SELECT 
          s.vertex_id as creator_id,
          s.properties as creator_properties
        FROM GRAPH_TABLE (knowledge_graph
          MATCH (s)-[e]->(t)
          WHERE t.vertex_type = 'WORK' 
            AND t.vertex_id = :workId
            AND e.edge_label = 'CREATED'
          COLUMNS (s.vertex_id, s.properties)
        )
      `,
            memgraph: `
        MATCH (creator:Person)-[:CREATED]->(work:Work {id: $workId})
        RETURN creator
      `
        };

        const params = this.dbType === 'oracle' ? { workId } : { workId };
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

    // Neues Werk erstellen
    async create(workData) {
        const id = workData.id || `work_${Date.now()}`;
        const properties = {
            id,
            name: workData.name,
            type: workData.type || 'NotableWork'
        };

        const queries = {
            oracle: `
        INSERT INTO kg_vertices (vertex_id, vertex_type, properties)
        VALUES (:id, 'WORK', :props)
      `,
            memgraph: `
        CREATE (w:Work $props)
        RETURN w
      `
        };

        const params = this.dbType === 'oracle'
            ? { id, props: JSON.stringify(properties) }
            : { props: properties };

        await this.execute(queries, params);
        return properties;
    }
}

module.exports = WorkRepository;