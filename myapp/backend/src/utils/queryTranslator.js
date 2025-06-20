// src/utils/QueryTranslator.js - Übersetzt Cypher nach SQL/PGQ für Oracle Property Graph
class QueryTranslator {
    constructor() {
        this.labelToType = {
            'Person': 'PERSON', 'Place': 'PLACE', 'Work': 'WORK',
            'Award': 'AWARD', 'Workplace': 'WORKPLACE',
            'Field': 'FIELD', 'Occupation': 'OCCUPATION'
        };
    }

    // Hauptmethode: Cypher zu Oracle SQL/PGQ
    translateCypherToOracle(cypherQuery) {
        const query = cypherQuery.trim();
        const upper = query.toUpperCase();

        if (upper.startsWith('MATCH')) return this.translateMatchQuery(query);
        if (upper.startsWith('CREATE')) return this.translateCreateQuery(query);
        if (upper.includes('DELETE')) return this.translateDeleteQuery(query);

        throw new Error('Nicht unterstützter Query-Typ');
    }

    // MATCH Query übersetzen
    translateMatchQuery(cypher) {
        // Einfaches Pattern: MATCH (n:Label {prop: value}) RETURN n
        const simpleMatch = /MATCH\s+\((\w+)(?::(\w+))?\s*(?:{([^}]+)})?\)\s*RETURN\s+(.+)/i;
        const match = cypher.match(simpleMatch);

        if (match) {
            const [_, varName, label, propsStr, returnClause] = match;
            const vertexType = label ? (this.labelToType[label] || label.toUpperCase()) : null;

            let sql = `
        SELECT v.vertex_id, v.vertex_type, v.properties
        FROM GRAPH_TABLE (knowledge_graph
          MATCH (v)`;

            const conditions = [];
            if (vertexType) {
                conditions.push(`v.vertex_type = '${vertexType}'`);
            }

            if (propsStr) {
                const props = this.parseProperties(propsStr);
                for (const [key, value] of Object.entries(props)) {
                    conditions.push(`JSON_VALUE(v.properties, '$.${key}') = '${value}'`);
                }
            }

            if (conditions.length > 0) {
                sql += `\n          WHERE ${conditions.join(' AND ')}`;
            }

            sql += `\n          COLUMNS (v.vertex_id, v.vertex_type, v.properties)\n        )`;

            // Limit handling
            if (returnClause.includes('LIMIT')) {
                const limitMatch = returnClause.match(/LIMIT\s+(\d+)/i);
                if (limitMatch) {
                    sql += `\n        FETCH FIRST ${limitMatch[1]} ROWS ONLY`;
                }
            }

            return sql;
        }

        // Relationship Pattern: MATCH (a)-[r:TYPE]->(b) RETURN a,b
        const relMatch = /MATCH\s+\((\w+)(?::(\w+))?\)\s*-\[(\w+)?:?(\w+)?\]->\s*\((\w+)(?::(\w+))?\)\s*RETURN\s+(.+)/i;
        const relResult = cypher.match(relMatch);

        if (relResult) {
            const [_, sourceVar, sourceLabel, relVar, relType, targetVar, targetLabel, returnVars] = relResult;

            return `
        SELECT s.vertex_id as source_id, s.properties as source_props,
               t.vertex_id as target_id, t.properties as target_props,
               e.edge_label as relationship_type
        FROM GRAPH_TABLE (knowledge_graph
          MATCH (s)-[e]->(t)
          WHERE ${relType ? `e.edge_label = '${relType}'` : '1=1'}
            ${sourceLabel ? `AND s.vertex_type = '${this.labelToType[sourceLabel] || sourceLabel.toUpperCase()}'` : ''}
            ${targetLabel ? `AND t.vertex_type = '${this.labelToType[targetLabel] || targetLabel.toUpperCase()}'` : ''}
          COLUMNS (s.vertex_id, s.properties, 
                  t.vertex_id, t.properties,
                  e.edge_label)
        )`;
        }

        throw new Error('Nicht unterstütztes MATCH Pattern');
    }

    // CREATE Query übersetzen
    translateCreateQuery(cypher) {
        // Node erstellen: CREATE (n:Person {name: "Test", id: "123"})
        const nodeMatch = /CREATE\s+\((?:\w+)?:(\w+)\s*{([^}]+)}\)/i;
        const match = cypher.match(nodeMatch);

        if (match) {
            const [_, label, propsStr] = match;
            const vertexType = this.labelToType[label] || label.toUpperCase();
            const props = this.parseProperties(propsStr);

            if (!props.id) {
                props.id = `${label.toLowerCase()}_${Date.now()}`;
            }

            return `
        INSERT INTO kg_vertices (vertex_id, vertex_type, properties)
        VALUES ('${props.id}', '${vertexType}', '${JSON.stringify(props)}')`;
        }

        // Relationship erstellen
        const relMatch = /CREATE\s+\((\w+)\)-\[:(\w+)\]->\((\w+)\)/i;
        const relResult = cypher.match(relMatch);

        if (relResult) {
            const [_, sourceVar, relType, targetVar] = relResult;

            return `
        INSERT INTO kg_edges (source_vertex_id, dest_vertex_id, edge_label, properties)
        SELECT s.vertex_id, t.vertex_id, '${relType}', '{}'
        FROM kg_vertices s, kg_vertices t
        WHERE s.vertex_id = :source_id AND t.vertex_id = :target_id`;
        }

        throw new Error('Nicht unterstütztes CREATE Pattern');
    }

    // DELETE Query übersetzen
    translateDeleteQuery(cypher) {
        // MATCH (n:Person {id: "123"}) DELETE n
        const match = /MATCH\s+\((\w+):(\w+)\s*{([^}]+)}\)\s*DELETE\s+\1/i;
        const result = cypher.match(match);

        if (result) {
            const [_, varName, label, propsStr] = result;
            const props = this.parseProperties(propsStr);

            if (props.id) {
                return `DELETE FROM kg_vertices WHERE vertex_id = '${props.id}'`;
            }
        }

        throw new Error('Nicht unterstütztes DELETE Pattern');
    }

    // Hilfsmethode: Properties parsen
    parseProperties(propsStr) {
        const props = {};
        const propRegex = /(\w+):\s*["']?([^,"']+)["']?/g;
        let match;

        while ((match = propRegex.exec(propsStr)) !== null) {
            props[match[1]] = match[2];
        }

        return props;
    }

    // Memgraph Cypher zu Cypher (nur Syntax-Anpassungen)
    translateCypherToMemgraph(cypherQuery) {
        // Memgraph versteht Standard-Cypher, nur kleine Anpassungen nötig
        return cypherQuery
            .replace(/\bLIMIT\b/gi, 'LIMIT')
            .replace(/\bRETURN\b/gi, 'RETURN')
            .trim();
    }
}

module.exports = QueryTranslator;