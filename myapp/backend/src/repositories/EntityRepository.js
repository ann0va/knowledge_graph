// src/repositories/EntityRepository.js - KOMPLETT NEU, EINFACH, FUNKTIONAL
const BaseRepository = require('./BaseRepository');

// Entity-Konfiguration - EINFACH UND KLAR
const ENTITY_CONFIGS = {
    person: {
        oracle_label: 'PERSON',
        memgraph_label: 'person',
        oracle_fields: ['id', 'name', 'birth_date', 'death_date', 'gender', 'description'],
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
    constructor(database, dbType, entityType, defaultGraph = 'mygraph') {
        super(database, dbType, defaultGraph);
        this.entityType = entityType;

        // Entity-Konfiguration laden
        this.config = ENTITY_CONFIGS[entityType];
        if (!this.config) {
            throw new Error(`Unknown entity type: ${entityType}. Available: ${Object.keys(ENTITY_CONFIGS).join(', ')}`);
        }
    }

    // 🎯 Alle Entities abrufen - Oracle: Funktioniert jetzt!
    async findAll(limit = 100) {
        const oracleLabel = this.config.oracle_label;
        const memgraphLabel = this.config.memgraph_label;
        // FORCE: Entferne 'id' aus oracle_fields falls es da ist
        const oracleFields = this.config.oracle_fields.filter(field => field !== 'id');
        const memgraphFields = this.config.memgraph_fields;

        const queries = {
            // Oracle: FUNKTIONIERT! Keine KEY-Referenzen
            oracle: `SELECT id(e) as vertex_id,
                            ${oracleFields.map(field => `e.${field}`).join(',\n                            ')}
                     FROM MATCH (e:${oracleLabel}) ON ALL_GRAPH
                     LIMIT ${limit}`,
            memgraph: `MATCH (e:${memgraphLabel})
                      RETURN id(e) as vertex_id,
                             labels(e) as labels,
                             ${memgraphFields.map(field => `e.${field}`).join(',\n                             ')},
                             properties(e) as all_properties
                      LIMIT $limit`
        };

        return await this.execute(queries, { limit: parseInt(limit) });
    }

    // 🎯 Entity nach Wikidata-ID suchen - Oracle: Gegen VERTEX_ID suchen (ALLE ENTITY-TYPEN)
    async findById(wikidataId) {
        const oracleLabel = this.config.oracle_label;
        const memgraphLabel = this.config.memgraph_label;
        const oracleFields = this.config.oracle_fields.filter(field => field !== 'id');
        const memgraphFields = this.config.memgraph_fields;

        // Oracle Tabellenname für Vertex ID (UPPERCASE + S am Ende)
        const oracleTableName = this.getOracleTableName();

        const queries = {
            // Oracle: Gegen vertex_id mit Tabellenpräfix suchen!
            oracle: `SELECT id(e) as vertex_id,
                            ${oracleFields.map(field => `e.${field}`).join(',\n                            ')}
                     FROM MATCH (e:${oracleLabel}) ON ALL_GRAPH
                     WHERE id(e) = '${oracleTableName}(${wikidataId})'`,
            // Memgraph: Wikidata-ID ist Property
            memgraph: `MATCH (e:${memgraphLabel} {id: $wikidataId})
                      RETURN id(e) as vertex_id,
                             labels(e) as labels,
                             ${memgraphFields.map(field => `e.${field}`).join(',\n                             ')},
                             properties(e) as all_properties`
        };

        const result = await this.execute(queries, { wikidataId });

        // Für Oracle: Füge die Wikidata-ID manuell hinzu (aus vertex_id extrahieren)
        if (result && this.dbType === 'oracle' && result.vertex_id) {
            // Extrahiere Q7251 aus PERSONS(Q7251)
            const match = result.vertex_id.match(/\(([^)]+)\)/);
            result.wikidata_id = match ? match[1] : wikidataId;
        }

        return Array.isArray(result) ? result[0] : result;
    }

    // 🎯 Oracle Tabellenname für Vertex ID ermitteln
    getOracleTableName() {
        // Mapping: EntityType -> Oracle Vertex Table Name
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

    // 🎯 Nach Name suchen
    async searchByName(searchTerm, limit = 20) {
        const oracleLabel = this.config.oracle_label;
        const memgraphLabel = this.config.memgraph_label;
        const oracleFields = this.config.oracle_fields;
        const memgraphFields = this.config.memgraph_fields;
        const searchField = this.config.searchField;

        const queries = {
            oracle: `SELECT id(e) as vertex_id,
                            ${oracleFields.map(field => `e.${field}`).join(',\n                            ')}
                     FROM MATCH (e:${oracleLabel}) ON ${this.defaultGraph}
                     WHERE UPPER(e.${searchField}) LIKE UPPER('%${searchTerm}%')
                     LIMIT ${limit}`,
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

    // 🎯 Beziehungen abrufen
    async getRelationships(wikidataId) {
        const oracleLabel = this.config.oracle_label;
        const memgraphLabel = this.config.memgraph_label;

        const queries = {
            oracle: `SELECT label(e) as relationship_type,
                            id(target) as target_vertex_id,
                            label(target) as target_type,
                            target.id as target_entity_id,
                            target.name as target_name
                     FROM MATCH (source:${oracleLabel})-[e]->(target) ON ${this.defaultGraph}
                     WHERE source.id = '${wikidataId}'`,
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

    // 🎯 Eingehende Beziehungen
    async getIncomingRelationships(wikidataId) {
        const oracleLabel = this.config.oracle_label;
        const memgraphLabel = this.config.memgraph_label;

        const queries = {
            oracle: `SELECT label(e) as relationship_type,
                            id(source) as source_vertex_id,
                            label(source) as source_type,
                            source.id as source_entity_id,
                            source.name as source_name
                     FROM MATCH (source)-[e]->(target:${oracleLabel}) ON ${this.defaultGraph}
                     WHERE target.id = '${wikidataId}'`,
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

    // 🎯 Spezifische Beziehungen
    async getSpecificRelationships(wikidataId, relationshipType, direction = 'outgoing') {
        const oracleLabel = this.config.oracle_label;
        const memgraphLabel = this.config.memgraph_label;

        const queries = {
            oracle: direction === 'outgoing'
                ? `SELECT label(e) as relationship_type,
                          id(target) as target_vertex_id,
                          label(target) as target_type,
                          target.id as target_entity_id,
                          target.name as target_name
                   FROM MATCH (source:${oracleLabel})-[e:${relationshipType}]->(target) ON ${this.defaultGraph}
                   WHERE source.id = '${wikidataId}'`
                : `SELECT label(e) as relationship_type,
                          id(source) as source_vertex_id,
                          label(source) as source_type,
                          source.id as source_entity_id,
                          source.name as source_name
                   FROM MATCH (source)-[e:${relationshipType}]->(target:${oracleLabel}) ON ${this.defaultGraph}
                   WHERE target.id = '${wikidataId}'`,
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

        return await this.execute(queries, { wikidataId });
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