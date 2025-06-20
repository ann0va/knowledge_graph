
// src/repositories/PersonRepository.js
const BaseRepository = require('./BaseRepository');

class PersonRepository extends BaseRepository {
    constructor(db, dbType) {
        super(db, dbType);
    }

    // Alle Personen abrufen
    async findAll(limit = 100) {
        const queries = {
            oracle: `
        SELECT x.id,
               x.props
        FROM TABLE(
          GRAPH_TABLE(
            knowledge_graph,                -- Graph-Name + Komma
            MATCH (v)
              WHERE v.vertex_type = 'PERSON'-- Filter für Person
            COLUMNS (                       -- welche Spalten wir zurückhaben wollen
              v.vertex_id   AS id,
              v.properties  AS props
            )
          )
        ) x                                 -- Alias
        FETCH FIRST :limit ROWS ONLY        -- klassisches LIMIT
      `,
            memgraph: `
        MATCH (p:Person)
        RETURN p
        LIMIT $limit
      `
        };

        const result = await this.execute(queries, { limit });

        if (this.dbType === 'oracle') {
            return result.rows.map(([id, props]) => ({ id, ...JSON.parse(props) }));
        }
        return result;
    }

    // Person nach ID suchen
    async findById(id) {
        const queries = {
            oracle: `
        SELECT x.id,
               x.props
        FROM TABLE(
          GRAPH_TABLE(
            knowledge_graph,
            MATCH (v)
              WHERE v.vertex_type = 'PERSON'
                AND v.vertex_id = :id
            COLUMNS (
              v.vertex_id   AS id,
              v.properties  AS props
            )
          )
        ) x
      `,
            memgraph: `
        MATCH (p:Person {id: $id})
        RETURN p
      `
        };

        const result = await this.execute(queries, { id });
        if (this.dbType === 'oracle' && result.rows?.length) {
            const [idVal, props] = result.rows[0];
            return { id: idVal, ...JSON.parse(props) };
        }
        return result?.[0] || null;
    }

    // Beziehungen einer Person abrufen
    async getRelationships(personId) {
        const queries = {
            oracle: `
        SELECT r.relationship_type,
               r.target_id,
               r.target_type,
               r.target_props
        FROM TABLE(
          GRAPH_TABLE(
            knowledge_graph,
            MATCH (s)-[e]->(t)
              WHERE s.vertex_type = 'PERSON'
                AND s.vertex_id = :personId
            COLUMNS (
              e.edge_label      AS relationship_type,
              t.vertex_id       AS target_id,
              t.vertex_type     AS target_type,
              t.properties      AS target_props
            )
          )
        ) r
      `,
            memgraph: `
        MATCH (p:Person {id: $personId})-[r]->(t)
        RETURN
          type(r)       AS relationship_type,
          id(t)         AS target_id,
          labels(t)[0]  AS target_type,
          t             AS node
      `
        };

        const result = await this.execute(queries, { personId });
        if (this.dbType === 'oracle') {
            return result.rows.map(([rt, id, tp, props]) => ({
                relationship_type: rt,
                target: { id, type: tp, ...JSON.parse(props) }
            }));
        }
        return result.map(({ relationship_type, target_type, node }) => ({
            relationship_type,
            target: { id: node.properties.id, type: target_type, ...node.properties }
        }));
    }
}

module.exports = PersonRepository;
