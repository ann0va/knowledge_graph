// src/repositories/AwardRepository.js
const BaseRepository = require('./BaseRepository');

class AwardRepository extends BaseRepository {
    constructor(db, dbType) {
        super(db, dbType);
    }

    // Alle Auszeichnungen abrufen
    async findAll(limit = 100) {
        const queries = {
            oracle: `
        SELECT v.vertex_id as id, v.properties
        FROM GRAPH_TABLE (knowledge_graph
          MATCH (v)
          WHERE v.vertex_type = 'AWARD'
          COLUMNS (v.vertex_id, v.properties)
        )
        FETCH FIRST ${limit} ROWS ONLY
      `,
            memgraph: `
        MATCH (a:Award) 
        RETURN a 
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

    // Auszeichnung nach ID suchen
    async findById(id) {
        const queries = {
            oracle: `
        SELECT v.vertex_id as id, v.properties
        FROM GRAPH_TABLE (knowledge_graph
          MATCH (v)
          WHERE v.vertex_type = 'AWARD' 
            AND v.vertex_id = :id
          COLUMNS (v.vertex_id, v.properties)
        )
      `,
            memgraph: `
        MATCH (a:Award {id: $id}) 
        RETURN a
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

    // Empfänger einer Auszeichnung finden
    async getRecipients(awardId) {
        const queries = {
            oracle: `
        SELECT 
          s.vertex_id as recipient_id,
          s.properties as recipient_properties
        FROM GRAPH_TABLE (knowledge_graph
          MATCH (s)-[e]->(t)
          WHERE t.vertex_type = 'AWARD' 
            AND t.vertex_id = :awardId
            AND e.edge_label = 'RECEIVED'
          COLUMNS (s.vertex_id, s.properties)
        )
      `,
            memgraph: `
        MATCH (recipient:Person)-[:RECEIVED]->(award:Award {id: $awardId})
        RETURN recipient
      `
        };

        const params = this.dbType === 'oracle' ? { awardId } : { awardId };
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

    // Neue Auszeichnung erstellen
    async create(awardData) {
        const id = awardData.id || `award_${Date.now()}`;
        const properties = {
            id,
            name: awardData.name
        };

        const queries = {
            oracle: `
        INSERT INTO kg_vertices (vertex_id, vertex_type, properties)
        VALUES (:id, 'AWARD', :props)
      `,
            memgraph: `
        CREATE (a:Award $props)
        RETURN a
      `
        };

        const params = this.dbType === 'oracle'
            ? { id, props: JSON.stringify(properties) }
            : { props: properties };

        await this.execute(queries, params);
        return properties;
    }
}

module.exports = AwardRepository;