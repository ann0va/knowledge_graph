// src/utils/queryTranslator.js
class QueryTranslator {
    /**
     * Übersetzt ein generisches Query-Objekt in SQL oder Cypher
     */
    static translateToSQL(entity, operation, params) {
        switch (operation) {
            case 'find':
                return this.buildSQLSelect(entity, params);
            case 'aggregate':
                return this.buildSQLAggregate(entity, params);
            case 'join':
                return this.buildSQLJoin(params);
            default:
                throw new Error(`Unbekannte SQL Operation: ${operation}`);
        }
    }

    static translateToCypher(entity, operation, params) {
        switch (operation) {
            case 'find':
                return this.buildCypherMatch(entity, params);
            case 'aggregate':
                return this.buildCypherAggregate(entity, params);
            case 'relation':
                return this.buildCypherRelation(params);
            default:
                throw new Error(`Unbekannte Cypher Operation: ${operation}`);
        }
    }

    // SQL Builders
    static buildSQLSelect(table, params) {
        const { fields = '*', where, orderBy, groupBy, limit } = params;

        let query = `SELECT ${Array.isArray(fields) ? fields.join(', ') : fields} FROM ${table}`;

        if (where) {
            const conditions = this.buildSQLConditions(where);
            query += ` WHERE ${conditions}`;
        }

        if (groupBy) {
            query += ` GROUP BY ${groupBy}`;
        }

        if (orderBy) {
            query += ` ORDER BY ${orderBy}`;
        }

        if (limit) {
            query += ` FETCH FIRST ${limit} ROWS ONLY`;
        }

        return query;
    }

    static buildSQLAggregate(table, params) {
        const { operation, field, where, groupBy } = params;

        let query = `SELECT `;

        if (groupBy) {
            query += `${groupBy}, `;
        }

        query += `${operation}(${field}) as result FROM ${table}`;

        if (where) {
            const conditions = this.buildSQLConditions(where);
            query += ` WHERE ${conditions}`;
        }

        if (groupBy) {
            query += ` GROUP BY ${groupBy}`;
        }

        return query;
    }

    static buildSQLJoin(params) {
        const { tables, joinOn, fields = '*', where } = params;

        let query = `SELECT ${fields} FROM ${tables[0]}`;

        for (let i = 1; i < tables.length; i++) {
            const joinCondition = joinOn[i - 1];
            query += ` JOIN ${tables[i]} ON ${joinCondition}`;
        }

        if (where) {
            const conditions = this.buildSQLConditions(where);
            query += ` WHERE ${conditions}`;
        }

        return query;
    }

    static buildSQLConditions(where) {
        return Object.entries(where)
            .map(([key, value]) => {
                if (typeof value === 'object') {
                    return this.buildSQLComplexCondition(key, value);
                }
                return `${key} = '${value}'`;
            })
            .join(' AND ');
    }

    static buildSQLComplexCondition(key, condition) {
        const { operator, value } = condition;

        switch (operator) {
            case 'gt': return `${key} > ${value}`;
            case 'gte': return `${key} >= ${value}`;
            case 'lt': return `${key} < ${value}`;
            case 'lte': return `${key} <= ${value}`;
            case 'ne': return `${key} != '${value}'`;
            case 'like': return `${key} LIKE '${value}'`;
            case 'in': return `${key} IN (${value.map(v => `'${v}'`).join(', ')})`;
            default: return `${key} = '${value}'`;
        }
    }

    // Cypher Builders
    static buildCypherMatch(label, params) {
        const { fields, where, orderBy, limit, relationships } = params;

        let query = `MATCH (n:${label})`;

        if (relationships) {
            query = this.addCypherRelationships(query, relationships);
        }

        if (where) {
            const conditions = this.buildCypherConditions(where);
            query += ` WHERE ${conditions}`;
        }

        query += ' RETURN ';

        if (fields && fields !== '*') {
            const fieldList = Array.isArray(fields)
                ? fields.map(f => `n.${f}`).join(', ')
                : `n.${fields}`;
            query += fieldList;
        } else {
            query += 'n';
        }

        if (orderBy) {
            query += ` ORDER BY n.${orderBy}`;
        }

        if (limit) {
            query += ` LIMIT ${limit}`;
        }

        return query;
    }

    static buildCypherAggregate(label, params) {
        const { operation, field, where, groupBy } = params;

        let query = `MATCH (n:${label})`;

        if (where) {
            const conditions = this.buildCypherConditions(where);
            query += ` WHERE ${conditions}`;
        }

        query += ' RETURN ';

        if (groupBy) {
            query += `n.${groupBy}, `;
        }

        query += `${operation}(n.${field}) as result`;

        return query;
    }

    static buildCypherRelation(params) {
        const { from, to, relationship, properties } = params;

        let query = `MATCH (a:${from.label}), (b:${to.label})`;

        if (from.where) {
            const fromConditions = this.buildCypherConditions(from.where, 'a');
            query += ` WHERE ${fromConditions}`;
        }

        if (to.where) {
            const toConditions = this.buildCypherConditions(to.where, 'b');
            query += from.where ? ` AND ${toConditions}` : ` WHERE ${toConditions}`;
        }

        query += ` CREATE (a)-[r:${relationship}`;

        if (properties) {
            const props = Object.entries(properties)
                .map(([k, v]) => `${k}: '${v}'`)
                .join(', ');
            query += ` {${props}}`;
        }

        query += ']->(b) RETURN a, r, b';

        return query;
    }

    static buildCypherConditions(where, alias = 'n') {
        return Object.entries(where)
            .map(([key, value]) => {
                if (typeof value === 'object') {
                    return this.buildCypherComplexCondition(alias, key, value);
                }
                return `${alias}.${key} = '${value}'`;
            })
            .join(' AND ');
    }

    static buildCypherComplexCondition(alias, key, condition) {
        const { operator, value } = condition;

        switch (operator) {
            case 'gt': return `${alias}.${key} > ${value}`;
            case 'gte': return `${alias}.${key} >= ${value}`;
            case 'lt': return `${alias}.${key} < ${value}`;
            case 'lte': return `${alias}.${key} <= ${value}`;
            case 'ne': return `${alias}.${key} <> '${value}'`;
            case 'contains': return `${alias}.${key} CONTAINS '${value}'`;
            case 'startsWith': return `${alias}.${key} STARTS WITH '${value}'`;
            case 'endsWith': return `${alias}.${key} ENDS WITH '${value}'`;
            case 'in': return `${alias}.${key} IN [${value.map(v => `'${v}'`).join(', ')}]`;
            default: return `${alias}.${key} = '${value}'`;
        }
    }

    static addCypherRelationships(query, relationships) {
        relationships.forEach(rel => {
            query += `-[${rel.variable || ''}:${rel.type}${rel.direction || ''}]-`;
            query += `(${rel.node}:${rel.label})`;
        });
        return query;
    }

    /**
     * Unified Query Interface - übersetzt abstrakte Queries in DB-spezifische
     */
    static translateUnifiedQuery(dbType, query) {
        const { entity, operation, params } = query;

        if (dbType === 'oracle') {
            return this.translateToSQL(entity, operation, params);
        } else if (dbType === 'memgraph') {
            return this.translateToCypher(entity, operation, params);
        }

        throw new Error(`Unbekannter Datenbanktyp: ${dbType}`);
    }
}

// Erweiterte Service-Methode für unified queries
// Fügen Sie diese Methode zur DataService Klasse hinzu:
/*
async executeUnifiedQuery(dbType, unifiedQuery) {
  const translatedQuery = QueryTranslator.translateUnifiedQuery(dbType, unifiedQuery);
  return await this.executeQuery(dbType, translatedQuery);
}
*/

// Beispiel-Verwendung:
const examples = {
    // Einfache Suche
    findUsers: {
        entity: 'User',
        operation: 'find',
        params: {
            fields: ['name', 'email'],
            where: {
                age: { operator: 'gt', value: 25 }
            },
            orderBy: 'name',
            limit: 10
        }
    },

    // Aggregation
    averageAge: {
        entity: 'User',
        operation: 'aggregate',
        params: {
            operation: 'AVG',
            field: 'age',
            where: {
                city: 'Berlin'
            }
        }
    },

    // Beziehungen (nur Memgraph)
    createRelation: {
        operation: 'relation',
        params: {
            from: {
                label: 'User',
                where: { id: 1 }
            },
            to: {
                label: 'Product',
                where: { id: 100 }
            },
            relationship: 'PURCHASED',
            properties: {
                date: '2025-01-15',
                quantity: 2
            }
        }
    }
};

module.exports = QueryTranslator;