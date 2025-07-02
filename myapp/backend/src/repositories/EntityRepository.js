// src/repositories/EntityRepository.js - ENHANCED with CREATE methods
const BaseRepository = require('./BaseRepository');

// 🔧 UPDATED: Entity-Konfiguration mit CREATE-Support
const ENTITY_CONFIGS = {
    person: {
        oracle_label: 'PERSON',
        memgraph_label: 'person',
        oracle_table: 'persons', // 🆕 Base Table für Oracle INSERTs
        oracle_safe_fields: ['name', 'birth_date', 'death_date', 'gender', 'description'],
        memgraph_fields: ['id', 'name', 'birth_date', 'death_date', 'gender', 'description'],
        searchField: 'name',
        required_fields: ['id', 'name'], // 🆕 Pflichtfelder für CREATE
        optional_fields: ['birth_date', 'death_date', 'gender', 'description'] // 🆕 Optionale Felder
    },
    place: {
        oracle_label: 'PLACE',
        memgraph_label: 'place',
        oracle_table: 'places',
        oracle_safe_fields: ['name', 'type'],
        memgraph_fields: ['id', 'name', 'type'],
        searchField: 'name',
        required_fields: ['id', 'name'],
        optional_fields: ['type']
    },
    work: {
        oracle_label: 'WORK',
        memgraph_label: 'work',
        oracle_table: 'works',
        oracle_safe_fields: ['name', 'type'],
        memgraph_fields: ['id', 'name', 'type'],
        searchField: 'name',
        required_fields: ['id', 'name'],
        optional_fields: ['type']
    },
    award: {
        oracle_label: 'AWARD',
        memgraph_label: 'award',
        oracle_table: 'awards',
        oracle_safe_fields: ['name'],
        memgraph_fields: ['id', 'name'],
        searchField: 'name',
        required_fields: ['id', 'name'],
        optional_fields: []
    },
    field: {
        oracle_label: 'FIELD',
        memgraph_label: 'field',
        oracle_table: 'fields',
        oracle_safe_fields: ['name'],
        memgraph_fields: ['id', 'name'],
        searchField: 'name',
        required_fields: ['id', 'name'],
        optional_fields: []
    },
    occupation: {
        oracle_label: 'OCCUPATION',
        memgraph_label: 'occupation',
        oracle_table: 'occupations',
        oracle_safe_fields: ['name'],
        memgraph_fields: ['id', 'name'],
        searchField: 'name',
        required_fields: ['id', 'name'],
        optional_fields: []
    },
    workplace: {
        oracle_label: 'WORKPLACE',
        memgraph_label: 'workplace',
        oracle_table: 'workplaces',
        oracle_safe_fields: ['name', 'type'],
        memgraph_fields: ['id', 'name', 'type'],
        searchField: 'name',
        required_fields: ['id', 'name'],
        optional_fields: ['type']
    }
};

// 🆕 EDGE-Konfiguration für Relationship Creation - ERWEITERT
const EDGE_CONFIGS = {
    RECEIVED: {
        oracle_table: 'received_edges',
        source_field: 'person_id',
        target_field: 'award_id',
        source_type: 'person',
        target_type: 'award',
        memgraph_type: 'RECEIVED',
        properties: []
    },
    WORKS_IN: {
        oracle_table: 'works_in_edges',
        source_field: 'person_id',
        target_field: 'field_id',
        source_type: 'person',
        target_type: 'field',
        memgraph_type: 'WORKS_IN',
        properties: []
    },
    WORKED_AT: {
        oracle_table: 'worked_at_edges',
        source_field: 'person_id',
        target_field: 'workplace_id',
        source_type: 'person',
        target_type: 'workplace',
        memgraph_type: 'WORKED_AT',
        properties: ['start_date', 'end_date']
    },
    HAS_OCCUPATION: {
        oracle_table: 'has_occupation_edges',
        source_field: 'person_id',
        target_field: 'occupation_id',
        source_type: 'person',
        target_type: 'occupation',
        memgraph_type: 'HAS_OCCUPATION',
        properties: []
    },
    STUDENT_OF: {
        oracle_table: 'student_of_edges',
        source_field: 'student_id',
        target_field: 'teacher_id',
        source_type: 'person',
        target_type: 'person',
        memgraph_type: 'STUDENT_OF',
        properties: []
    },
    ADVISED: {
        oracle_table: 'advised_edges',
        source_field: 'advisor_id',
        target_field: 'advisee_id',
        source_type: 'person',
        target_type: 'person',
        memgraph_type: 'ADVISED',
        properties: []
    },
    BIRTH_IN: {
        oracle_table: 'birth_in_edges',
        source_field: 'person_id',
        target_field: 'place_id',
        source_type: 'person',
        target_type: 'place',
        memgraph_type: 'BIRTH_IN',
        properties: []
    },
    DIED_IN: {
        oracle_table: 'died_in_edges',
        source_field: 'person_id',
        target_field: 'place_id',
        source_type: 'person',
        target_type: 'place',
        memgraph_type: 'DIED_IN',
        properties: []
    },
    NATIONAL_OF: {
        oracle_table: 'national_of_edges',
        source_field: 'person_id',
        target_field: 'place_id',
        source_type: 'person',
        target_type: 'place',
        memgraph_type: 'NATIONAL_OF',
        properties: []
    },
    CREATED: {
        oracle_table: 'created_edges',
        source_field: 'person_id',
        target_field: 'work_id',
        source_type: 'person',
        target_type: 'work',
        memgraph_type: 'CREATED',
        properties: []
    },
    FATHER_OF: {
        oracle_table: 'father_edges',
        source_field: 'father_id',
        target_field: 'child_id',
        source_type: 'person',
        target_type: 'person',
        memgraph_type: 'FATHER_OF',
        properties: []
    },
    MOTHER_OF: {
        oracle_table: 'mother_edges',
        source_field: 'mother_id',
        target_field: 'child_id',
        source_type: 'person',
        target_type: 'person',
        memgraph_type: 'MOTHER_OF',
        properties: []
    },
    PARTNER_OF: {
        oracle_table: 'partner_edges',
        source_field: 'person1_id',
        target_field: 'person2_id',
        source_type: 'person',
        target_type: 'person',
        memgraph_type: 'PARTNER_OF',
        properties: []
    },
    INFLUENCED_BY: {
        oracle_table: 'influence_edges',
        source_field: 'influenced_id',
        target_field: 'influencer_id',
        source_type: 'person',
        target_type: 'person',
        memgraph_type: 'INFLUENCED_BY',
        properties: []
    },
    RELATIVE_OF: {
        oracle_table: 'relative_edges',
        source_field: 'person1_id',
        target_field: 'person2_id',
        source_type: 'person',
        target_type: 'person',
        memgraph_type: 'RELATIVE_OF',
        properties: []
    },
    SIGNIFICANT_PERSON_FOR: {
        oracle_table: 'significant_person_edges',
        source_field: 'significant_person_id',
        target_field: 'for_person_id',
        source_type: 'person',
        target_type: 'person',
        memgraph_type: 'SIGNIFICANT_PERSON_FOR',
        properties: []
    }
};

// Verfügbare Relationship-Typen (erweitert)
const RELATIONSHIP_TYPES = Object.keys(EDGE_CONFIGS);

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

    // 🆕 CREATE NODE: Neuen Knoten erstellen
    async createNode(nodeData) {
        console.log(`🆕 Creating ${this.entityType} node:`, nodeData);

        // Validation
        const validationError = this.validateNodeData(nodeData);
        if (validationError) {
            throw new Error(`Validation failed: ${validationError}`);
        }

        // Wikidata ID generieren falls nicht vorhanden
        if (!nodeData.id) {
            nodeData.id = this.generateWikidataId();
        }

        if (this.dbType === 'oracle') {
            return await this.createOracleNode(nodeData);
        } else if (this.dbType === 'memgraph') {
            return await this.createMemgraphNode(nodeData);
        }

        throw new Error(`Unsupported database type: ${this.dbType}`);
    }

    // 🔧 Oracle Node Creation mit DATE-FORMAT FIX
    async createOracleNode(nodeData) {
        const tableName = this.config.oracle_table;
        const allFields = [...this.config.required_fields, ...this.config.optional_fields];

        // Nur verfügbare Felder extrahieren + DATE CONVERSION
        const insertData = {};
        for (const field of allFields) {
            if (nodeData[field] !== undefined && nodeData[field] !== null) {
                let value = nodeData[field];

                // 🔧 DATE FORMAT FIX für Oracle
                if (field.includes('date') && value) {
                    // Convert YYYY-MM-DD zu Oracle DATE Format
                    console.log(`🔧 Converting date field ${field}: ${value}`);
                    insertData[field] = `TO_DATE('${value}', 'YYYY-MM-DD')`;
                } else {
                    insertData[field] = value;
                }
            }
        }

        console.log(`🔍 Oracle SQL INSERT into ${tableName}:`, insertData);

        try {
            // DIRECT SQL CONNECTION (not PGQL!)
            const { getOracleConnection } = require('../config/database');
            const oracledb = require('oracledb');

            let connection = await getOracleConnection();

            // SQL INSERT Statement bauen - SPECIAL HANDLING für Dates
            const columns = Object.keys(insertData).join(', ');

            // 🔧 FIXED: Separate Behandlung für Dates und normale Values
            const placeholders = [];
            const values = [];
            let placeholderIndex = 1;

            for (const [key, value] of Object.entries(insertData)) {
                if (key.includes('date') && typeof value === 'string' && value.startsWith('TO_DATE')) {
                    // Für Dates: Direkt TO_DATE() verwenden
                    placeholders.push(value);
                } else {
                    // Für normale Values: Placeholder verwenden
                    placeholders.push(`:${placeholderIndex}`);
                    values.push(value);
                    placeholderIndex++;
                }
            }

            const insertQuery = `INSERT INTO ${tableName} (${columns}) VALUES (${placeholders.join(', ')})`;

            console.log(`🔍 Oracle SQL query:`, insertQuery);
            console.log(`🔍 Oracle SQL values:`, values);

            const result = await connection.execute(insertQuery, values, { autoCommit: true });

            console.log(`✅ Oracle SQL insert result:`, result);

            await connection.close();

            // 🔧 SIMPLIFIED: Oracle SQL INSERT war erfolgreich, kein PGQL Verify nötig
            return {
                success: true,
                node: {
                    id: nodeData.id,
                    name: nodeData.name,
                    created_via: 'oracle_sql_insert'
                },
                wikidataId: nodeData.id,
                database: 'oracle',
                table: tableName,
                rowsAffected: result.rowsAffected,
                message: 'Node created successfully via Oracle SQL INSERT'
            };

        } catch (error) {
            console.error(`❌ Oracle SQL insert failed:`, error);
            throw new Error(`Oracle SQL CREATE failed: ${error.message}`);
        }
    }

    // 🔧 Memgraph Node Creation via Cypher CREATE
    async createMemgraphNode(nodeData) {
        const label = this.config.memgraph_label;
        const allFields = [...this.config.required_fields, ...this.config.optional_fields];

        // Properties für Cypher bauen
        const properties = {};
        for (const field of allFields) {
            if (nodeData[field] !== undefined && nodeData[field] !== null) {
                properties[field] = nodeData[field];
            }
        }

        // Cypher CREATE Statement
        const propertyStrings = Object.keys(properties).map(key => `${key}: $${key}`);
        const createQuery = `
            CREATE (n:${label} {${propertyStrings.join(', ')}})
            RETURN id(n) as vertex_id, n
        `;

        console.log(`🔍 Memgraph CREATE query:`, createQuery);
        console.log(`🔍 Memgraph CREATE data:`, properties);

        const queries = {
            memgraph: createQuery
        };

        try {
            const result = await this.execute(queries, properties);
            console.log(`✅ Memgraph node created:`, result);

            // Erstellten Node zurückgeben
            const createdNode = Array.isArray(result) ? result[0] : result;
            return {
                success: true,
                node: createdNode,
                wikidataId: nodeData.id,
                database: 'memgraph',
                label: label,
                memgraphId: createdNode.vertex_id
            };

        } catch (error) {
            console.error(`❌ Memgraph node creation failed:`, error);
            throw new Error(`Memgraph CREATE failed: ${error.message}`);
        }
    }

    // 🆕 CREATE EDGE: Neue Beziehung zwischen existierenden Knoten
    async createEdge(edgeData) {
        console.log(`🆕 Creating edge:`, edgeData);

        const { relationshipType, sourceId, targetId, properties = {} } = edgeData;

        // Validation
        if (!relationshipType || !sourceId || !targetId) {
            throw new Error('relationshipType, sourceId, and targetId are required');
        }

        if (!EDGE_CONFIGS[relationshipType]) {
            throw new Error(`Unknown relationship type: ${relationshipType}. Available: ${RELATIONSHIP_TYPES.join(', ')}`);
        }

        if (this.dbType === 'oracle') {
            return await this.createOracleEdge(edgeData);
        } else if (this.dbType === 'memgraph') {
            return await this.createMemgraphEdge(edgeData);
        }

        throw new Error(`Unsupported database type: ${this.dbType}`);
    }

    // 🔧 Oracle Edge Creation via SEPARATE SQL CONNECTION
    async createOracleEdge(edgeData) {
        const { relationshipType, sourceId, targetId, properties = {} } = edgeData;
        const edgeConfig = EDGE_CONFIGS[relationshipType];

        const tableName = edgeConfig.oracle_table;
        const sourceField = edgeConfig.source_field;
        const targetField = edgeConfig.target_field;

        // Insert-Daten bauen
        const insertData = {
            [sourceField]: sourceId,
            [targetField]: targetId,
            ...properties
        };

        console.log(`🔍 Oracle EDGE SQL INSERT into ${tableName}:`, insertData);

        try {
            // DIRECT SQL CONNECTION (not PGQL!)
            const { getOracleConnection } = require('../config/database');
            const oracledb = require('oracledb');

            let connection = await getOracleConnection();

            // SQL INSERT Statement
            const columns = Object.keys(insertData).join(', ');
            const placeholders = Object.keys(insertData).map((_, i) => `:${i + 1}`).join(', ');
            const values = Object.values(insertData);

            const insertQuery = `INSERT INTO ${tableName} (${columns}) VALUES (${placeholders})`;

            console.log(`🔍 Oracle EDGE SQL query:`, insertQuery);
            console.log(`🔍 Oracle EDGE SQL values:`, values);

            const result = await connection.execute(insertQuery, values, { autoCommit: true });

            console.log(`✅ Oracle EDGE SQL insert result:`, result);

            await connection.close();

            return {
                success: true,
                edge: {
                    relationshipType,
                    sourceId,
                    targetId,
                    properties
                },
                database: 'oracle',
                table: tableName,
                rowsAffected: result.rowsAffected
            };

        } catch (error) {
            console.error(`❌ Oracle EDGE SQL insert failed:`, error);
            throw new Error(`Oracle EDGE SQL CREATE failed: ${error.message}`);
        }
    }

    // 🔧 Memgraph Edge Creation via Cypher CREATE - FIXED für interne IDs
    async createMemgraphEdge(edgeData) {
        const { relationshipType, sourceId, targetId, properties = {} } = edgeData;
        const edgeConfig = EDGE_CONFIGS[relationshipType];

        const sourceType = edgeConfig.source_type;
        const targetType = edgeConfig.target_type;
        const memgraphType = edgeConfig.memgraph_type;

        console.log(`🔍 Memgraph Edge Creation: ${sourceType}(${sourceId}) -[${memgraphType}]-> ${targetType}(${targetId})`);

        // 🔧 FIXED: Verwende Wikidata-IDs für MATCH, nicht interne Memgraph IDs
        let createQuery;
        const queryParams = { sourceId, targetId, ...properties };

        if (Object.keys(properties).length > 0) {
            const propStrings = Object.keys(properties).map(key => `${key}: ${key}`);
            createQuery = `
                MATCH (source:${sourceType} {id: $sourceId}), (target:${targetType} {id: $targetId})
                CREATE (source)-[r:${memgraphType} {${propStrings.join(', ')}}]->(target)
                RETURN r, id(r) as relationship_id
            `;
        } else {
            createQuery = `
                MATCH (source:${sourceType} {id: $sourceId}), (target:${targetType} {id: $targetId})
                CREATE (source)-[r:${memgraphType}]->(target)
                RETURN r, id(r) as relationship_id
            `;
        }

        console.log(`🔍 Memgraph EDGE CREATE:`, createQuery);
        console.log(`🔍 Memgraph EDGE data:`, queryParams);

        const queries = { memgraph: createQuery };

        try {
            const result = await this.execute(queries, queryParams);
            console.log(`✅ Memgraph edge created:`, result);

            const createdEdge = Array.isArray(result) ? result[0] : result;
            return {
                success: true,
                edge: {
                    relationshipType: memgraphType,
                    sourceId,
                    targetId,
                    properties,
                    memgraphRelationshipId: createdEdge.relationship_id || null,
                    relationshipData: createdEdge.r || null
                },
                database: 'memgraph',
                sourceType,
                targetType
            };

        } catch (error) {
            console.error(`❌ Memgraph edge creation failed:`, error);

            // 🔧 BETTER ERROR MESSAGE für Node nicht gefunden
            if (error.message.includes('expected 1') || error.message.includes('expected 2')) {
                throw new Error(`Could not find entities: ${sourceType}(${sourceId}) or ${targetType}(${targetId}) in Memgraph. Make sure both entities exist with the correct Wikidata IDs.`);
            }

            throw new Error(`Memgraph EDGE CREATE failed: ${error.message}`);
        }
    }

    // 🗑️ DELETE NODE: Knoten und alle seine Beziehungen löschen
    async deleteNode(wikidataId) {
        console.log(`🗑️ Deleting ${this.entityType} node: ${wikidataId}`);

        if (this.dbType === 'oracle') {
            return await this.deleteOracleNode(wikidataId);
        } else if (this.dbType === 'memgraph') {
            return await this.deleteMemgraphNode(wikidataId);
        }

        throw new Error(`Unsupported database type: ${this.dbType}`);
    }

// 🔧 Oracle Node Deletion
    async deleteOracleNode(wikidataId) {
        try {
            const { getOracleConnection } = require('../config/database');
            let connection = await getOracleConnection();

            const tableName = this.config.oracle_table;

            console.log(`🗑️ Oracle SQL DELETE from ${tableName} where id = ${wikidataId}`);

            // 1. Erst alle Edge-Tabellen durchgehen und Referenzen löschen
            const edgeTableCleanup = [];

            // Alle Edge-Configs durchgehen und nach Referenzen auf diesen Node suchen
            for (const [edgeType, edgeConfig] of Object.entries(EDGE_CONFIGS)) {
                const edgeTable = edgeConfig.oracle_table;
                const sourceField = edgeConfig.source_field;
                const targetField = edgeConfig.target_field;

                // Source references löschen
                if (edgeConfig.source_type === this.entityType) {
                    const deleteSourceQuery = `DELETE FROM ${edgeTable} WHERE ${sourceField} = :wikidataId`;
                    const sourceResult = await connection.execute(deleteSourceQuery, { wikidataId }, { autoCommit: false });
                    edgeTableCleanup.push({
                        table: edgeTable,
                        field: sourceField,
                        deleted: sourceResult.rowsAffected
                    });
                }

                // Target references löschen
                if (edgeConfig.target_type === this.entityType) {
                    const deleteTargetQuery = `DELETE FROM ${edgeTable} WHERE ${targetField} = :wikidataId`;
                    const targetResult = await connection.execute(deleteTargetQuery, { wikidataId }, { autoCommit: false });
                    edgeTableCleanup.push({
                        table: edgeTable,
                        field: targetField,
                        deleted: targetResult.rowsAffected
                    });
                }
            }

            // 2. Node selbst löschen
            const deleteNodeQuery = `DELETE FROM ${tableName} WHERE id = :wikidataId`;
            const nodeResult = await connection.execute(deleteNodeQuery, { wikidataId }, { autoCommit: false });

            if (nodeResult.rowsAffected === 0) {
                await connection.rollback();
                await connection.close();
                throw new Error(`Node with ID ${wikidataId} not found in ${tableName}`);
            }

            // 3. Commit alle Änderungen
            await connection.commit();
            await connection.close();

            const totalEdgesDeleted = edgeTableCleanup.reduce((sum, cleanup) => sum + cleanup.deleted, 0);

            console.log(`✅ Oracle node deleted: ${nodeResult.rowsAffected} node, ${totalEdgesDeleted} edges`);

            return {
                success: true,
                deletedNode: {
                    wikidataId,
                    entityType: this.entityType,
                    table: tableName
                },
                deletedEdges: {
                    count: totalEdgesDeleted,
                    details: edgeTableCleanup.filter(cleanup => cleanup.deleted > 0)
                },
                database: 'oracle',
                message: `Node and ${totalEdgesDeleted} related edges deleted successfully`
            };

        } catch (error) {
            console.error(`❌ Oracle node deletion failed:`, error);
            throw new Error(`Oracle DELETE failed: ${error.message}`);
        }
    }

// 🔧 Memgraph Node Deletion
    async deleteMemgraphNode(wikidataId) {
        const label = this.config.memgraph_label;

        // Cypher DELETE mit DETACH (löscht automatisch alle Beziehungen)
        const deleteQuery = `
        MATCH (n:${label} {id: $wikidataId})
        OPTIONAL MATCH (n)-[r]-()
        WITH n, count(r) as edgeCount
        DETACH DELETE n
        RETURN edgeCount
    `;

        console.log(`🗑️ Memgraph DELETE query:`, deleteQuery);

        const queries = { memgraph: deleteQuery };

        try {
            const result = await this.execute(queries, { wikidataId });
            console.log(`✅ Memgraph deletion result:`, result);

            const deletionResult = Array.isArray(result) ? result[0] : result;
            const edgeCount = deletionResult?.edgeCount || 0;

            return {
                success: true,
                deletedNode: {
                    wikidataId,
                    entityType: this.entityType,
                    label: label
                },
                deletedEdges: {
                    count: edgeCount
                },
                database: 'memgraph',
                message: `Node and ${edgeCount} related edges deleted successfully`
            };

        } catch (error) {
            console.error(`❌ Memgraph node deletion failed:`, error);

            if (error.message.includes('expected 1') || error.message.includes('expected at least 1')) {
                throw new Error(`Node with ID ${wikidataId} not found in Memgraph`);
            }

            throw new Error(`Memgraph DELETE failed: ${error.message}`);
        }
    }

// 🗑️ DELETE EDGE: Spezifische Beziehung löschen
    async deleteEdge(edgeData) {
        console.log(`🗑️ Deleting edge:`, edgeData);

        const { relationshipType, sourceId, targetId } = edgeData;

        // Validation
        if (!relationshipType || !sourceId || !targetId) {
            throw new Error('relationshipType, sourceId, and targetId are required for deletion');
        }

        if (!EDGE_CONFIGS[relationshipType]) {
            throw new Error(`Unknown relationship type: ${relationshipType}`);
        }

        if (this.dbType === 'oracle') {
            return await this.deleteOracleEdge(edgeData);
        } else if (this.dbType === 'memgraph') {
            return await this.deleteMemgraphEdge(edgeData);
        }

        throw new Error(`Unsupported database type: ${this.dbType}`);
    }

// 🔧 Oracle Edge Deletion
    async deleteOracleEdge(edgeData) {
        const { relationshipType, sourceId, targetId } = edgeData;
        const edgeConfig = EDGE_CONFIGS[relationshipType];

        const tableName = edgeConfig.oracle_table;
        const sourceField = edgeConfig.source_field;
        const targetField = edgeConfig.target_field;

        console.log(`🗑️ Oracle EDGE DELETE from ${tableName}: ${sourceId} -> ${targetId}`);

        try {
            const { getOracleConnection } = require('../config/database');
            let connection = await getOracleConnection();

            const deleteQuery = `DELETE FROM ${tableName} WHERE ${sourceField} = :sourceId AND ${targetField} = :targetId`;
            const result = await connection.execute(deleteQuery, { sourceId, targetId }, { autoCommit: true });

            await connection.close();

            if (result.rowsAffected === 0) {
                throw new Error(`Edge ${relationshipType} from ${sourceId} to ${targetId} not found`);
            }

            console.log(`✅ Oracle edge deleted: ${result.rowsAffected} rows`);

            return {
                success: true,
                deletedEdge: {
                    relationshipType,
                    sourceId,
                    targetId
                },
                database: 'oracle',
                table: tableName,
                rowsAffected: result.rowsAffected
            };

        } catch (error) {
            console.error(`❌ Oracle edge deletion failed:`, error);
            throw new Error(`Oracle EDGE DELETE failed: ${error.message}`);
        }
    }

// 🔧 Memgraph Edge Deletion
    async deleteMemgraphEdge(edgeData) {
        const { relationshipType, sourceId, targetId } = edgeData;
        const edgeConfig = EDGE_CONFIGS[relationshipType];

        const sourceType = edgeConfig.source_type;
        const targetType = edgeConfig.target_type;
        const memgraphType = edgeConfig.memgraph_type;

        const deleteQuery = `
        MATCH (source:${sourceType} {id: $sourceId})-[r:${memgraphType}]->(target:${targetType} {id: $targetId})
        DELETE r
        RETURN count(r) as deletedCount
    `;

        console.log(`🗑️ Memgraph EDGE DELETE:`, deleteQuery);

        const queries = { memgraph: deleteQuery };

        try {
            const result = await this.execute(queries, { sourceId, targetId });
            console.log(`✅ Memgraph edge deletion result:`, result);

            const deletionResult = Array.isArray(result) ? result[0] : result;
            const deletedCount = deletionResult?.deletedCount || 0;

            if (deletedCount === 0) {
                throw new Error(`Edge ${relationshipType} from ${sourceId} to ${targetId} not found`);
            }

            return {
                success: true,
                deletedEdge: {
                    relationshipType: memgraphType,
                    sourceId,
                    targetId
                },
                database: 'memgraph',
                deletedCount: deletedCount
            };

        } catch (error) {
            console.error(`❌ Memgraph edge deletion failed:`, error);
            throw new Error(`Memgraph EDGE DELETE failed: ${error.message}`);
        }
    }

// 🗑️ BULK DELETE: Mehrere Nodes eines Entity-Types löschen
    async bulkDeleteNodes(wikidataIds) {
        console.log(`🗑️ Bulk deleting ${wikidataIds.length} ${this.entityType} nodes`);

        const results = {
            success: true,
            deleted: [],
            failed: [],
            totalRequested: wikidataIds.length,
            totalDeleted: 0,
            totalFailed: 0
        };

        for (const wikidataId of wikidataIds) {
            try {
                const result = await this.deleteNode(wikidataId);
                results.deleted.push(result);
                results.totalDeleted++;
            } catch (error) {
                results.failed.push({
                    wikidataId,
                    error: error.message
                });
                results.totalFailed++;
            }
        }

        results.success = results.totalFailed === 0;

        return results;
    }
    

    // 🔧 Node Data Validation
    validateNodeData(nodeData) {
        // Pflichtfelder prüfen
        for (const field of this.config.required_fields) {
            if (field === 'id') continue; // ID wird automatisch generiert falls nicht vorhanden
            if (!nodeData[field] || nodeData[field].trim() === '') {
                return `Required field '${field}' is missing or empty`;
            }
        }

        // Name-spezifische Validierung
        if (nodeData.name && nodeData.name.length > 200) {
            return 'Name must be less than 200 characters';
        }

        // Datum-Validierung für Personen
        if (this.entityType === 'person') {
            if (nodeData.birth_date && nodeData.death_date) {
                const birth = new Date(nodeData.birth_date);
                const death = new Date(nodeData.death_date);
                if (death <= birth) {
                    return 'Death date must be after birth date';
                }
            }
        }

        return null; // Keine Fehler
    }

    // 🔧 Wikidata ID Generator
    generateWikidataId() {
        // Random 10-stellige Zahl als Q-ID
        const randomNum = Math.floor(1000000000 + Math.random() * 9000000000);
        return `Q${randomNum}`;
    }

    // 🎯 STATIC: Verfügbare Edge-Typen
    static getAvailableEdgeTypes() {
        return RELATIONSHIP_TYPES;
    }

    // 🎯 STATIC: Edge-Konfiguration abrufen
    static getEdgeConfig(edgeType) {
        return EDGE_CONFIGS[edgeType] || null;
    }

    // 🎯 STATIC: Alle Entity-Configs für Frontend
    static getAllEntityConfigs() {
        return ENTITY_CONFIGS;
    }

    // 🎯 STATIC: Alle Edge-Configs für Frontend
    static getAllEdgeConfigs() {
        return EDGE_CONFIGS;
    }

    // 🎯 Bestehende Methoden bleiben unverändert...
    async findAll(limit = 100) {
        const oracleLabel = this.config.oracle_label;
        const memgraphLabel = this.config.memgraph_label;
        const oracleSafeFields = this.config.oracle_safe_fields || ['name'];
        const memgraphFields = this.config.memgraph_fields;

        console.log(`🔍 Using safe Oracle fields for ${this.entityType}:`, oracleSafeFields);

        const queries = {
            oracle: `SELECT id(e) as vertex_id,
                            ${oracleSafeFields.map(field => `e.${field}`).join(',\n                            ')}
                     FROM MATCH (e:${oracleLabel}) ON ${this.defaultGraph}
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


    // 🔧 ALIAS für UPDATE-Kompatibilität
    async findByWikidataId(wikidataId) {
        // Einfach an bestehende findById delegieren
        return await this.findById(wikidataId);
    }

    // 🔧 ORACLE FIX: Enhanced findById mit korrektem Oracle Schema
    async findById(wikidataId) {
        console.log(`🔍 [DEBUG] findById called: ${wikidataId} | DB: ${this.dbType}`);

        if (this.dbType === 'oracle') {
            // 🚨 ORACLE SPEZIAL-BEHANDLUNG: e.id existiert nicht!
            const oracleLabel = this.config.oracle_label;
            const oracleSafeFields = this.config.oracle_safe_fields || ['name'];
            const oracleTableName = this.getOracleTableName();

            console.log(`🔍 [ORACLE] Label: ${oracleLabel}, Table: ${oracleTableName}, Fields: ${oracleSafeFields}`);

            // 🔧 STRATEGY 1: Nur vertex_id verwenden (KEIN e.id!)
            const strategy1Query = `SELECT id(e) as vertex_id,
                                           ${oracleSafeFields.map(field => `e.${field}`).join(',\n                                           ')}
                                    FROM MATCH (e:${oracleLabel}) ON ${this.defaultGraph}
                                    WHERE id(e) = '${oracleTableName}(${wikidataId})'`;

            console.log(`🔍 [ORACLE Strategy 1] Vertex ID only:`, strategy1Query);

            try {
                const result1 = await this.execute({ oracle: strategy1Query }, {});

                if (result1 && (Array.isArray(result1) ? result1.length > 0 : result1)) {
                    console.log(`✅ [ORACLE Strategy 1] Success:`, result1);

                    const finalResult = Array.isArray(result1) ? result1[0] : result1;

                    // Oracle Vertex ID Processing
                    if (finalResult.vertex_id) {
                        const match = finalResult.vertex_id.match(/\(([^)]+)\)/);
                        finalResult.wikidata_id = match ? match[1] : wikidataId;
                    }

                    return finalResult;
                }
            } catch (error1) {
                console.warn(`❌ [ORACLE Strategy 1] Failed:`, error1.message);
            }

            // 🔧 STRATEGY 2: Direct SQL Fallback
            console.log(`🔄 [ORACLE Strategy 2] Direct SQL fallback...`);

            try {
                const { getOracleConnection } = require('../config/database');
                let connection = await getOracleConnection();

                // First, let's see what columns exist
                const columnsQuery = `SELECT column_name FROM user_tab_columns WHERE table_name = '${this.config.oracle_table.toUpperCase()}'`;
                console.log(`🔍 [ORACLE SQL] Checking columns:`, columnsQuery);

                const columnsResult = await connection.execute(columnsQuery);
                const availableColumns = columnsResult.rows.map(row => row[0].toLowerCase());
                console.log(`📋 [ORACLE] Available columns:`, availableColumns);

                // Try to find the person by ID in available columns
                let personQuery;
                let queryParams;

                if (availableColumns.includes('id')) {
                    personQuery = `SELECT * FROM ${this.config.oracle_table} WHERE id = :wikidataId`;
                    queryParams = { wikidataId };
                } else if (availableColumns.includes('wikidata_id')) {
                    personQuery = `SELECT * FROM ${this.config.oracle_table} WHERE wikidata_id = :wikidataId`;
                    queryParams = { wikidataId };
                } else if (availableColumns.includes('person_id')) {
                    personQuery = `SELECT * FROM ${this.config.oracle_table} WHERE person_id = :wikidataId`;
                    queryParams = { wikidataId };
                } else {
                    // Last resort: try name-based lookup if we have the person name
                    personQuery = `SELECT * FROM ${this.config.oracle_table} WHERE rownum <= 10`;
                    queryParams = {};
                }

                console.log(`🔍 [ORACLE SQL] Query:`, personQuery);
                console.log(`🔍 [ORACLE SQL] Params:`, queryParams);

                const sqlResult = await connection.execute(personQuery, queryParams);
                await connection.close();

                console.log(`📋 [ORACLE SQL] Raw result:`, {
                    rowsCount: sqlResult.rows?.length,
                    metaData: sqlResult.metaData?.map(col => ({ name: col.name, type: col.dbType })),
                    firstRow: sqlResult.rows?.[0]
                });

                if (sqlResult.rows && sqlResult.rows.length > 0) {
                    // Convert Oracle SQL result to expected format
                    const fieldNames = sqlResult.metaData.map(col => col.name.toLowerCase());

                    // Find the right row if multiple returned
                    let targetRow = sqlResult.rows[0]; // Default to first

                    if (sqlResult.rows.length > 1) {
                        // Try to find exact match by different ID fields
                        for (let i = 0; i < sqlResult.rows.length; i++) {
                            const row = sqlResult.rows[i];
                            for (let j = 0; j < fieldNames.length; j++) {
                                const value = row[j];
                                if (value === wikidataId || value === `Q${wikidataId}` ||
                                    (typeof value === 'string' && value.includes(wikidataId))) {
                                    targetRow = row;
                                    console.log(`🎯 [ORACLE] Found exact match in row ${i}, field ${fieldNames[j]}`);
                                    break;
                                }
                            }
                        }
                    }

                    const result = {};
                    fieldNames.forEach((fieldName, index) => {
                        result[fieldName] = targetRow[index];
                    });

                    // Add expected properties
                    result.vertex_id = `${oracleTableName}(${wikidataId})`;
                    result.wikidata_id = wikidataId;

                    console.log(`✅ [ORACLE SQL] Converted result:`, result);
                    return result;

                } else {
                    throw new Error(`Person with ID ${wikidataId} not found in Oracle table ${this.config.oracle_table}`);
                }

            } catch (sqlError) {
                console.error(`❌ [ORACLE SQL] Direct query failed:`, sqlError);
                throw new Error(`Oracle person lookup failed: ${sqlError.message}`);
            }

        } else {
            // Memgraph - bleibt unverändert
            const memgraphLabel = this.config.memgraph_label;
            const memgraphFields = this.config.memgraph_fields;

            const queries = {
                memgraph: `MATCH (e:${memgraphLabel} {id: $wikidataId})
                          RETURN id(e) as vertex_id,
                                 labels(e) as labels,
                                 ${memgraphFields.map(field => `e.${field}`).join(',\n                                 ')},
                                 properties(e) as all_properties`
            };

            const result = await this.execute(queries, { wikidataId });
            return Array.isArray(result) ? result[0] : result;
        }
    }

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

    async searchByName(searchTerm, limit = 20) {
        if (!searchTerm || searchTerm.trim() === '') {
            console.log(`🔍 Empty search term, using findAll for ${this.entityType}`);
            return await this.findAll(limit);
        }

        const oracleLabel = this.config.oracle_label;
        const memgraphLabel = this.config.memgraph_label;
        const oracleSafeFields = this.config.oracle_safe_fields || ['name'];
        const memgraphFields = this.config.memgraph_fields;
        const searchField = this.config.searchField;

        const queries = {
            oracle: `SELECT id(e) as vertex_id,
                            ${oracleSafeFields.map(field => `e.${field}`).join(',\n                            ')}
                     FROM MATCH (e:${oracleLabel}) ON ${this.defaultGraph}
                     WHERE java_regexp_like(e.${searchField}, '.*${searchTerm}.*', 'i')
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

    async getRelationships(wikidataId) {
        const oracleLabel = this.config.oracle_label;
        const memgraphLabel = this.config.memgraph_label;

        const queries = {
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

    async getIncomingRelationships(wikidataId) {
        const oracleLabel = this.config.oracle_label;
        const memgraphLabel = this.config.memgraph_label;

        const queries = {
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

    async getSpecificRelationships(wikidataId, relationshipType, direction = 'outgoing') {
        const oracleLabel = this.config.oracle_label;
        const memgraphLabel = this.config.memgraph_label;
        const oracleTableName = this.getOracleTableName();
        const expectedVertexId = `${oracleTableName}(${wikidataId})`;

        const queries = {
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

        return await this.execute(queries, { wikidataId });
    }

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

    static getAvailableEntityTypes() {
        return Object.keys(ENTITY_CONFIGS);
    }

    static getEntityConfig(entityType) {
        return ENTITY_CONFIGS[entityType] || null;
    }

    static getAvailableRelationshipTypes() {
        return RELATIONSHIP_TYPES;
    }
}

module.exports = EntityRepository;