// src/services/api.js - ENHANCED with CREATE methods
import axios from 'axios';

// Backend Base URL
const BASE_URL = 'http://c017-master.infcs.de:10510/api';

// Axios instance mit Basis-Konfiguration
const api = axios.create({
    baseURL: BASE_URL,
    timeout: 10000,
    headers: {
        'Content-Type': 'application/json',
    }
});

// API Service Klasse
class ApiService {
    // Health Check
    async health() {
        const response = await api.get('/health');
        return response.data;
    }

    // 🆕 GET Entity & Edge Configurations - für Frontend Forms
    async getEntityConfigurations() {
        const response = await api.get('/entity/types');
        return response.data;
    }

    // 🆕 CREATE NODE: Neuen Knoten erstellen
    async createNode(entityType, nodeData, database = 'memgraph') {
        try {
            console.log(`🆕 Creating ${entityType} node:`, nodeData);

            const response = await api.post(`/entity/${entityType}/create?db=${database}`, nodeData);
            return response.data;
        } catch (error) {
            console.error(`❌ Node creation failed:`, error);
            throw new Error(error.response?.data?.error || error.message);
        }
    }

    // 🆕 CREATE EDGE: Neue Beziehung zwischen Knoten erstellen
    async createEdge(edgeData, database = 'memgraph') {
        try {
            console.log(`🆕 Creating edge:`, edgeData);

            // 🔧 FIXED: Send edgeData directly, not wrapped in nodeData
            const response = await api.post(`/entity/edge/create?db=${database}`, edgeData);
            return response.data;
        } catch (error) {
            console.error(`❌ Edge creation failed:`, error);
            throw new Error(error.response?.data?.error || error.message);
        }
    }

    // 🆕 Wikidata ID Generator (Frontend Fallback)
    generateWikidataId() {
        const randomNum = Math.floor(1000000000 + Math.random() * 9000000000);
        return `Q${randomNum}`;
    }

    // 🆕 VALIDATE NODE DATA: Frontend Validation vor CREATE
    validateNodeData(entityType, nodeData, entityConfigs) {
        if (!entityConfigs || !entityConfigs[entityType]) {
            return `Unknown entity type: ${entityType}`;
        }

        const config = entityConfigs[entityType];
        const requiredFields = config.required_fields || [];

        // Pflichtfelder prüfen (ID ausgenommen, wird automatisch generiert)
        for (const field of requiredFields) {
            if (field === 'id') continue;
            if (!nodeData[field] || nodeData[field].toString().trim() === '') {
                return `Required field '${field}' is missing or empty`;
            }
        }

        // Name-Länge prüfen
        if (nodeData.name && nodeData.name.length > 200) {
            return 'Name must be less than 200 characters';
        }

        // Person-spezifische Validierung
        if (entityType === 'person') {
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

    // 🆕 VALIDATE EDGE DATA: Frontend Validation vor Edge CREATE
    validateEdgeData(edgeData, edgeConfigs) {
        const { relationshipType, sourceId, targetId } = edgeData;

        if (!relationshipType) {
            return 'Relationship type is required';
        }

        if (!sourceId || sourceId.trim() === '') {
            return 'Source entity ID is required';
        }

        if (!targetId || targetId.trim() === '') {
            return 'Target entity ID is required';
        }

        if (sourceId === targetId) {
            return 'Source and target must be different entities';
        }

        if (!edgeConfigs || !edgeConfigs[relationshipType]) {
            return `Unknown relationship type: ${relationshipType}`;
        }

        return null; // Keine Fehler
    }

    // BESTEHENDE METHODEN (unverändert)

    // Entity Operations
    async getEntities(entityType, params = {}) {
        const { source = 'both', limit = 100, search, db = 'both' } = params;

        if (source === 'both' || db === 'both') {
            const results = { success: true, data: { oracle: [], memgraph: [] } };

            try {
                const oracleResponse = await api.get(`/entity/${entityType}?db=oracle&limit=${limit}`);
                if (oracleResponse.data.success) {
                    results.data.oracle = oracleResponse.data.data.entities || [];
                }
            } catch (err) {
                console.warn(`Oracle query failed for ${entityType}:`, err);
            }

            try {
                const memgraphResponse = await api.get(`/entity/${entityType}?db=memgraph&limit=${limit}`);
                if (memgraphResponse.data.success) {
                    results.data.memgraph = memgraphResponse.data.data.entities || [];
                }
            } catch (err) {
                console.warn(`Memgraph query failed for ${entityType}:`, err);
            }

            return results;
        }

        const queryParams = new URLSearchParams({ db: source, limit });
        if (search) {
            queryParams.append('search', search);
        }

        const response = await api.get(`/entity/${entityType}?${queryParams}`);
        return response.data;
    }

    // Einzelne Entity abrufen
    async getEntity(entityType, id, source = 'memgraph') {
        const response = await api.get(`/entity/${entityType}/${id}?db=${source}`);
        return response.data;
    }

    // Relationships einer Entity
    async getEntityRelationships(entityType, id, relationshipType, source = 'memgraph') {
        const response = await api.get(`/entity/${entityType}/${id}/relationships?db=${source}`);
        return response.data;
    }

    // Global Search
    async globalSearch(query, entityType = null, source = 'both', limit = 10) {
        const params = new URLSearchParams({ q: query, db: source, limit });
        if (entityType) {
            params.append('type', entityType);
        }

        const response = await api.get(`/search?${params}`);
        return response.data;
    }

    // Verfügbare Entity-Typen
    getAvailableEntityTypes() {
        return ['person', 'award', 'field', 'place', 'work', 'workplace', 'occupation'];
    }

    // 🗑️ DELETE NODE: Knoten löschen
    async deleteNode(entityType, wikidataId, database = 'memgraph') {
        try {
            console.log(`🗑️ Deleting ${entityType} node: ${wikidataId}`);

            const response = await api.delete(`/entity/${entityType}/${wikidataId}?db=${database}`);
            return response.data;
        } catch (error) {
            console.error(`❌ Node deletion failed:`, error);
            throw new Error(error.response?.data?.error || error.message);
        }
    }

// 🗑️ DELETE EDGE: Beziehung löschen
    async deleteEdge(edgeData, database = 'memgraph') {
        try {
            console.log(`🗑️ Deleting edge:`, edgeData);

            const response = await api.delete(`/entity/edge/delete?db=${database}`, {
                data: edgeData // DELETE mit Body
            });
            return response.data;
        } catch (error) {
            console.error(`❌ Edge deletion failed:`, error);
            throw new Error(error.response?.data?.error || error.message);
        }
    }

// 🗑️ BULK DELETE NODES: Mehrere Knoten löschen
    async bulkDeleteNodes(entityType, wikidataIds, database = 'memgraph') {
        try {
            console.log(`🗑️ Bulk deleting ${wikidataIds.length} ${entityType} nodes`);

            const response = await api.delete(`/entity/${entityType}/bulk?db=${database}`, {
                data: { wikidataIds }
            });
            return response.data;
        } catch (error) {
            console.error(`❌ Bulk deletion failed:`, error);
            throw new Error(error.response?.data?.error || error.message);
        }
    }

// 🔍 FIND NODE FOR DELETION: Node suchen und Infos für Deletion anzeigen
    async getNodeForDeletion(entityType, wikidataId, database = 'memgraph') {
        try {
            // Node Details abrufen
            const nodeResponse = await this.getEntity(entityType, wikidataId, database);

            // Related Edges zählen
            const relationshipsResponse = await this.getEntityRelationships(entityType, wikidataId, null, database);

            const outgoingCount = relationshipsResponse.data?.relationships?.outgoing?.length || 0;
            const incomingCount = relationshipsResponse.data?.relationships?.incoming?.length || 0;
            const totalRelationships = outgoingCount + incomingCount;

            return {
                success: true,
                node: nodeResponse.data.entity,
                relationshipInfo: {
                    total: totalRelationships,
                    outgoing: outgoingCount,
                    incoming: incomingCount,
                    details: relationshipsResponse.data?.relationships
                },
                deletionWarning: totalRelationships > 0 ?
                    `This node has ${totalRelationships} relationships that will also be deleted.` :
                    'This node has no relationships.',
                canDelete: true
            };
        } catch (error) {
            console.error(`❌ Failed to get node for deletion:`, error);
            throw new Error(error.response?.data?.error || error.message);
        }
    }

// 🔍 FIND EDGE FOR DELETION: Edge suchen und für Deletion vorbereiten
    async findEdgeForDeletion(relationshipType, sourceId, targetId, database = 'memgraph') {
        try {
            console.log(`🔍 Finding edge for deletion: ${relationshipType} from ${sourceId} to ${targetId}`);

            // Edge-Konfiguration abrufen
            const configs = await this.getEntityConfigurations();
            const edgeConfig = configs.edgeConfigs?.[relationshipType];

            if (!edgeConfig) {
                throw new Error(`Unknown relationship type: ${relationshipType}`);
            }

            // Source und Target Entities abrufen für Anzeige
            const sourceEntity = await this.getEntity(edgeConfig.source_type, sourceId, database);
            const targetEntity = await this.getEntity(edgeConfig.target_type, targetId, database);

            return {
                success: true,
                edgeInfo: {
                    relationshipType,
                    sourceId,
                    targetId,
                    sourceEntity: sourceEntity.data?.entity,
                    targetEntity: targetEntity.data?.entity,
                    sourceType: edgeConfig.source_type,
                    targetType: edgeConfig.target_type
                },
                canDelete: true,
                deletionWarning: `This will delete the ${relationshipType} relationship between ${sourceEntity.data?.entity?.name || sourceId} and ${targetEntity.data?.entity?.name || targetId}.`
            };
        } catch (error) {
            console.error(`❌ Failed to find edge for deletion:`, error);
            return {
                success: false,
                error: error.message,
                canDelete: false
            };
        }
    }

// 🔍 VALIDATE DELETION: Vor dem Löschen validieren
    validateDeletion(type, data) {
        if (type === 'node') {
            const { entityType, wikidataId } = data;

            if (!entityType) {
                return 'Entity type is required';
            }

            if (!wikidataId || wikidataId.trim() === '') {
                return 'Wikidata ID is required';
            }

            if (!this.getAvailableEntityTypes().includes(entityType)) {
                return `Invalid entity type: ${entityType}`;
            }

            return null; // Valid
        }

        if (type === 'edge') {
            const { relationshipType, sourceId, targetId } = data;

            if (!relationshipType) {
                return 'Relationship type is required';
            }

            if (!sourceId || sourceId.trim() === '') {
                return 'Source entity ID is required';
            }

            if (!targetId || targetId.trim() === '') {
                return 'Target entity ID is required';
            }

            return null; // Valid
        }

        return 'Unknown deletion type';
    }

    // Spezifische Entity-Methoden
    async getPeople(params) {
        return this.getEntities('person', params);
    }

    async getAwards(params) {
        return this.getEntities('award', params);
    }

    async getFields(params) {
        return this.getEntities('field', params);
    }

    async getPlaces(params) {
        return this.getEntities('place', params);
    }

    async getWorks(params) {
        return this.getEntities('work', params);
    }

    async getWorkplaces(params) {
        return this.getEntities('workplace', params);
    }

    async getOccupations(params) {
        return this.getEntities('occupation', params);
    }

    // Structured Query ausführen
    async executeStructuredQuery(queryData) {
        const response = await api.post('/query/structured', queryData);
        return response.data;
    }

    // Entity-Namen für Autocomplete suchen
    async searchEntityNames(entityType, searchTerm = '', db = 'memgraph', limit = 100) {
        const response = await api.get(`/entity/${entityType}/search`, {
            params: {
                q: searchTerm, 
                db,
                limit
            }
        });
        return response.data;
    }

    // Alle Entities eines Typs laden
    async getAllEntitiesOfType(entityType, db = 'memgraph', limit = 100) {
        return this.searchEntityNames(entityType, '', db, limit);
    }

    // Raw Query ausführen
    async executeRawQuery(database, query, params = {}) {
        const response = await api.post('/query', {
            source: database,
            query,
            params
        });
        return response.data;
    }
}

// Singleton Export
const apiService = new ApiService();
export default apiService;