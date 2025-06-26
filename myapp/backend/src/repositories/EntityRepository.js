// src/repositories/EntityRepository.js - KORRIGIERTE Oracle PGQL Syntax
const BaseRepository = require('./BaseRepository');

// Entity-Konfiguration - EINFACH UND KLAR
const ENTITY_CONFIGS = {
    person: {
        oracle_label: 'PERSON',
        memgraph_label: 'person',
        oracle_fields: ['name', 'birth_date', 'death_date', 'gender', 'description'], // KEIN 'id'!
        memgraph_fields: ['id', 'name', 'birth_date', 'death_date', 'gender', 'description'],
        searchField: 'name'
    },
    place: {
        oracle_label: 'PLACE',
        memgraph_label: 'place',
        oracle_fields: ['id', 'name', 'type'],
        memgraph_fields: ['id', 'name', 'type'],
        searchField: 'name'
    },
    work: {
        oracle_label: 'WORK',
        memgraph_label: 'work',
        oracle_fields: ['id', 'name', 'type'],
        memgraph_fields: ['id', 'name', 'type'],
        searchField: 'name'
    },
    award: {
        oracle_label: 'AWARD',
        memgraph_label: 'award',
        oracle_fields: ['id', 'name'],
        memgraph_fields: ['id', 'name'],
        searchField: 'name'
    },
    field: {
        oracle_label: 'FIELD',
        memgraph_label: 'field',
        oracle_fields: ['id', 'name'],
        memgraph_fields: ['id', 'name'],
        searchField: 'name'
    },
    occupation: {
        oracle_label: 'OCCUPATION',
        memgraph_label: 'occupation',
        oracle_fields: ['id', 'name'],
        memgraph_fields: ['id', 'name'],
        searchField: 'name'
    },
    workplace: {
        oracle_label: 'WORKPLACE',
        memgraph_label: 'workplace',
        oracle_fields: ['id', 'name', 'type'],
        memgraph_fields: ['id', 'name', 'type'],
        searchField: 'name'
    }
};

// Verfügbare Relationship-Typen
const RELATIONSHIP_TYPES = [
    'WORKS_IN', 'BORN_IN', 'DIED_IN', 'EDUCATED_AT', 'WORKED_AT',
    'AWARDED', 'HAS_OCCUPATION', 'STUDIED', 'KNOWN_FOR', 'CITIZENSHIP'
];

class EntityRepository extends BaseRepository {
    constructor(database, dbType, entityType, defaultGraph = 'ALL_GRAPH') {
        super(database, dbType);
        this.entityType = entityType;
        this.defaultGraph = defaultGraph;

        // Entity-Konfiguration laden
        this.config = ENTITY_CONFIGS[entityType];
        if (!this.config) {
            throw new Error(`Unknown entity type: ${entityType}. Available: ${Object.keys(ENTITY_CONFIGS).join(', ')}`);
        }
    }

    // 🎯 Alle Entities abrufen - FIXED: Korrekte Labels verwenden
    async findAll(limit = 100) {
        const oracleLabel = this.config.oracle_label;  // 'PERSON'
        const memgraphLabel = this.config.memgraph_label;  // 'person'
        const oracleFields = this.config.oracle_fields.filter(field => field !== 'id');
        const memgraphFields = this.config.memgraph_fields;

        console.log(`🔍 Using labels: Oracle="${oracleLabel}", Memgraph="${memgraphLabel}"`);

        const queries = {
            // Oracle: UPPERCASE Label
            oracle: `SELECT id(e) as vertex_id,
                            ${oracleFields.map(field => `e.${field}`).join(',\n                            ')}
                     FROM MATCH (e:${oracleLabel}) ON ${this.defaultGraph}
                         LIMIT ${limit}`,
            // Memgraph: LOWERCASE Label (aus config!)
            memgraph: `MATCH (e:${memgraphLabel})
                      RETURN id(e) as vertex_id,
                             labels(e) as labels,
                             ${memgraphFields.map(field => `e.${field}`).join(',\n                             ')},
                             properties(e) as all_properties
                      LIMIT $limit`
        };

        return await this.execute(queries, { limit: parseInt(limit) });
    }

    // 🎯 Entity nach Wikidata-ID suchen
    async findById(wikidataId) {
        const oracleLabel = this.config.oracle_label;
        const memgraphLabel = this.config.memgraph_label;
        const oracleFields = this.config.oracle_fields.filter(field => field !== 'id');
        const memgraphFields = this.config.memgraph_fields;

        // Oracle Tabellenname für Vertex ID
        const oracleTableName = this.getOracleTableName();

        const queries = {
            // Oracle: Suche mit verschiedenen ID-Formaten
            oracle: `SELECT id(e) as vertex_id,
                            ${oracleFields.map(field => `e.${field}`).join(',\n                            ')}
                     FROM MATCH (e:${oracleLabel}) ON ${this.defaultGraph}
                     WHERE e.id = '${wikidataId}' OR id(e) = '${oracleTableName}(${wikidataId})'`,
            // Memgraph: Wikidata-ID ist Property
            memgraph: `MATCH (e:${memgraphLabel} {id: $wikidataId})
                      RETURN id(e) as vertex_id,
                             labels(e) as labels,
                             ${memgraphFields.map(field => `e.${field}`).join(',\n                             ')},
                             properties(e) as all_properties`
        };

        const result = await this.execute(queries, { wikidataId });

        // Für Oracle: Füge die Wikidata-ID manuell hinzu
        if (result && this.dbType === 'oracle' && result.vertex_id) {
            const match = result.vertex_id.match(/\(([^)]+)\)/);
            result.wikidata_id = match ? match[1] : wikidataId;
        }

        return Array.isArray(result) ? result[0] : result;
    }

    // 🎯 Oracle Tabellenname für Vertex ID ermitteln
    getOracleTableName() {
        const tableMapping = {
            'person': 'PERSONS',
            'place': 'PLACES',
            'work': 'WORKS',
            'award': 'AWARDS',
            'field': 'FIELDS',
            'occupation': 'OCCUPATIONS',
            'workplace': 'WORKPLACES'
        };

        return tableMapping[this.entityType] || this.entityType.toUpperCase() + 'S';
    }

    // 🎯 Nach Name suchen - FIXED: Korrekte Labels
    async searchByName(searchTerm, limit = 20) {
        const oracleLabel = this.config.oracle_label;   // 'PERSON'
        const memgraphLabel = this.config.memgraph_label; // 'person'
        const oracleFields = this.config.oracle_fields;
        const memgraphFields = this.config.memgraph_fields;
        const searchField = this.config.searchField;

        console.log(`🔍 Search labels: Oracle="${oracleLabel}", Memgraph="${memgraphLabel}"`);

        const queries = {
            // 🔧 ORACLE PGQL FINAL: Verwende nur Gleichheit oder Regex
            oracle: `SELECT id(e) as vertex_id,
                            ${oracleFields.map(field => `e.${field}`).join(',\n                            ')}
                     FROM MATCH (e:${oracleLabel}) ON ${this.defaultGraph}
                     WHERE java_regexp_like(e.${searchField}, '.*${searchTerm}.*', 'i')
                         LIMIT ${limit}`,
            // Memgraph bleibt unverändert
            memgraph: `MATCH (e:${memgraphLabel})
                      WHERE toUpper(e.${searchField}) CONTAINS toUpper($searchTerm)
                      RETURN id(e) as vertex_id,
                             labels(e) as labels,
                             ${memgraphFields.map(field => `e.${field}`).join(',\n                             ')},
                             properties(e) as all_properties
                      LIMIT $limit`
        };

        return await this.execute(queries, { searchTerm, limit: parseInt(limit) });
    }

    // 🎯 Beziehungen abrufen - Oracle PGQL ohne labels()
    async getRelationships(wikidataId) {
        const oracleLabel = this.config.oracle_label;
        const memgraphLabel = this.config.memgraph_label;

        const queries = {
            // 🔧 ORACLE PGQL: OHNE labels() Funktion
            oracle: `SELECT label(e) as relationship_type,
                            id(target) as target_vertex_id,
                            target.name as target_name
                     FROM MATCH (source:${oracleLabel})-[e]->(target) ON ${this.defaultGraph}
                     WHERE id(source) = 'PERSONS(${wikidataId})'`,
            memgraph: `MATCH (source:${memgraphLabel} {id: $wikidataId})-[e]->(target)
                      RETURN type(e) as relationship_type,
                             id(target) as target_vertex_id,
                             labels(target) as target_labels,
                             target.id as target_entity_id,
                             target.name as target_name,
                             properties(target) as target_properties`
        };

        return await this.execute(queries, { wikidataId });
    }

    // 🎯 Eingehende Beziehungen - KORRIGIERTE Oracle PGQL  
    async getIncomingRelationships(wikidataId) {
        const oracleLabel = this.config.oracle_label;
        const memgraphLabel = this.config.memgraph_label;

        const queries = {
            // 🔧 FIXED: Oracle PGQL - Keine labels() Funktion, korrektes Pattern Matching
            oracle: `SELECT label(e) as relationship_type,
                            id(source) as source_vertex_id,
                            source.name as source_name
                     FROM MATCH (source)-[e]->(target:${oracleLabel}) ON ${this.defaultGraph}
                     WHERE id(target) = 'PERSONS(${wikidataId})'`,
            memgraph: `MATCH (source)-[e]->(target:${memgraphLabel} {id: $wikidataId})
                      RETURN type(e) as relationship_type,
                             id(source) as source_vertex_id,
                             labels(source) as source_labels,
                             source.id as source_entity_id,
                             source.name as source_name,
                             properties(source) as source_properties`
        };

        return await this.execute(queries, { wikidataId });
    }

    // In getSpecificRelationships() Methode - NACH Zeile 172:
    async getSpecificRelationships(wikidataId, relationshipType, direction = 'outgoing') {
        const oracleLabel = this.config.oracle_label;
        const memgraphLabel = this.config.memgraph_label;

        // 🔍 DEBUG LOGS HINZUFÜGEN:
        console.log(`🔍 getSpecificRelationships DEBUG:`);
        console.log(`   Entity Type: ${this.entityType}`);
        console.log(`   Oracle Label: ${oracleLabel}`);
        console.log(`   Memgraph Label: ${memgraphLabel}`);
        console.log(`   Wikidata ID: ${wikidataId}`);
        console.log(`   Relationship Type: ${relationshipType}`);
        console.log(`   Direction: ${direction}`);

        // ORACLE TABLENAME DEBUG:
        const oracleTableName = this.getOracleTableName();
        console.log(`   Oracle Table Name: ${oracleTableName}`);
        const expectedVertexId = `${oracleTableName}(${wikidataId})`;
        console.log(`   Expected Vertex ID: ${expectedVertexId}`);

        const queries = {
            // 🔧 FIXED: Verwende dynamischen Tabellennamen statt hardcoded 'PERSONS'
            oracle: direction === 'outgoing'
                ? `SELECT label(e) as relationship_type,
                      id(target) as target_vertex_id,
                      target.name as target_name
               FROM MATCH (source:${oracleLabel})-[e:${relationshipType}]->(target) ON ${this.defaultGraph}
               WHERE id(source) = '${expectedVertexId}'`
                : `SELECT label(e) as relationship_type,
                      id(source) as source_vertex_id,
                      source.name as source_name
               FROM MATCH (source)-[e:${relationshipType}]->(target:${oracleLabel}) ON ${this.defaultGraph}
               WHERE id(target) = '${expectedVertexId}'`,
            memgraph: direction === 'outgoing'
                ? `MATCH (source:${memgraphLabel} {id: $wikidataId})-[e:${relationshipType}]->(target)
               RETURN type(e) as relationship_type,
                      id(target) as target_vertex_id,
                      labels(target) as target_labels,
                      target.id as target_entity_id,
                      target.name as target_name,
                      properties(target) as target_properties`
                : `MATCH (source)-[e:${relationshipType}]->(target:${memgraphLabel} {id: $wikidataId})
               RETURN type(e) as relationship_type,
                      id(source) as source_vertex_id,
                      labels(source) as source_labels,
                      source.id as source_entity_id,
                      source.name as source_name,
                      properties(source) as source_properties`
        };

        // 🔍 GENERATED QUERIES DEBUG:
        console.log(`🔍 Generated Oracle Query:`, queries.oracle);
        console.log(`🔍 Generated Memgraph Query:`, queries.memgraph);

        const result = await this.execute(queries, { wikidataId });

        // 🔍 RESULT DEBUG:
        console.log(`🔍 Query Result:`, JSON.stringify(result, null, 2));

        return result;
    }

    // 🎯 Statistiken
    async getStats() {
        const oracleLabel = this.config.oracle_label;
        const memgraphLabel = this.config.memgraph_label;

        const queries = {
            oracle: `SELECT COUNT(*) as total_count
                     FROM MATCH (e:${oracleLabel}) ON ${this.defaultGraph}`,
            memgraph: `MATCH (e:${memgraphLabel})
                      RETURN COUNT(e) as total_count`
        };

        const result = await this.execute(queries);
        return Array.isArray(result) ? result[0] : result;
    }

    // 🎯 Health Check
    async healthCheck() {
        try {
            const result = await this.findAll(1);
            return {
                status: 'ok',
                entityType: this.entityType,
                dbType: this.dbType,
                testResult: result.length > 0
            };
        } catch (error) {
            return {
                status: 'error',
                entityType: this.entityType,
                dbType: this.dbType,
                error: error.message
            };
        }
    }

    // 🎯 STATIC: Alle verfügbaren Entity-Typen
    static getAvailableEntityTypes() {
        return Object.keys(ENTITY_CONFIGS);
    }

    // 🎯 STATIC: Konfiguration für Entity-Typ abrufen
    static getEntityConfig(entityType) {
        return ENTITY_CONFIGS[entityType] || null;
    }

    // 🎯 STATIC: Alle verfügbaren Relationship-Typen
    static getAvailableRelationshipTypes() {
        return RELATIONSHIP_TYPES;
    }
}

module.exports = EntityRepository;