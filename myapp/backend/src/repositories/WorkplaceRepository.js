// src/repositories/WorkplaceRepository.js
const BaseRepository = require('./BaseRepository');

class WorkplaceRepository extends BaseRepository {
    constructor(db, dbType) {
        super(db, dbType);
    }

    // Alle Arbeitsstätten abrufen
    async findAll(limit = 100) {
        const queries = {
            oracle: `
        SELECT v.vertex_id as id, v.properties
        FROM GRAPH_TABLE (knowledge_graph
          MATCH (v)
          WHERE v.vertex_type = 'WORKPLACE'
          COLUMNS (v.vertex_id, v.properties)
        )
        FETCH FIRST ${limit} ROWS ONLY
      `,
            memgraph: `
        MATCH (w:Workplace) 
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

    // Arbeitsstätte nach ID suchen
    async findById(id) {
        const queries = {
            oracle: `
        SELECT v.vertex_id as id, v.properties
        FROM GRAPH_TABLE (knowledge_graph
          MATCH (v)
          WHERE v.vertex_type = 'WORKPLACE' 
            AND v.vertex_id = :id
          COLUMNS (v.vertex_id, v.properties)
        )
      `,
            memgraph: `
        MATCH (w:Workplace {id: $id}) 
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

    // Mitarbeiter einer Arbeitsstätte finden
    async getEmployees(workplaceId) {
        const queries = {
            oracle: `
        SELECT 
          s.vertex_id as employee_id,
          s.properties as employee_properties
        FROM GRAPH_TABLE (knowledge_graph
          MATCH (s)-[e]->(t)
          WHERE t.vertex_type = 'WORKPLACE' 
            AND t.vertex_id = :workplaceId
            AND e.edge_label = 'WORKED_AT'
          COLUMNS (s.vertex_id, s.properties)
        )
      `,
            memgraph: `
        MATCH (employee:Person)-[:WORKED_AT]->(workplace:Workplace {id: $workplaceId})
        RETURN employee
      `
        };

        const params = this.dbType === 'oracle' ? { workplaceId } : { workplaceId };
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

    // Neue Arbeitsstätte erstellen
    async create(workplaceData) {
        const id = workplaceData.id || `workplace_${Date.now()}`;
        const properties = {
            id,
            name: workplaceData.name,
            type: workplaceData.type || 'Institution'
        };

        const queries = {
            oracle: `
        INSERT INTO kg_vertices (vertex_id, vertex_type, properties)
        VALUES (:id, 'WORKPLACE', :props)
      `,
            memgraph: `
        CREATE (w:Workplace $props)
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

module.exports = WorkplaceRepository;