// src/services/api.js - Angepasst für neue Backend Entity API
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

    // 🎯 NEUE: Entity Operations - angepasst für /api/entity/{type}
    async getEntities(entityType, params = {}) {
        const { source = 'both', limit = 100, search, db = 'both' } = params;

        // Für source=both: Beide Datenbanken einzeln abfragen
        if (source === 'both' || db === 'both') {
            const results = { success: true, data: { oracle: [], memgraph: [] } };

            try {
                // Oracle abfragen - NEUER PFAD!
                const oracleResponse = await api.get(`/entity/${entityType}?db=oracle&limit=${limit}`);
                if (oracleResponse.data.success) {
                    results.data.oracle = oracleResponse.data.data.entities || [];
                }
            } catch (err) {
                console.warn(`Oracle query failed for ${entityType}:`, err);
            }

            try {
                // Memgraph abfragen - NEUER PFAD!
                const memgraphResponse = await api.get(`/entity/${entityType}?db=memgraph&limit=${limit}`);
                if (memgraphResponse.data.success) {
                    results.data.memgraph = memgraphResponse.data.data.entities || [];
                }
            } catch (err) {
                console.warn(`Memgraph query failed for ${entityType}:`, err);
            }

            return results;
        }

        // Einzelne Datenbank - NEUER PFAD!
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

    // Global Search (falls implementiert)
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

    // Spezifische Entity-Methoden für einfache Verwendung
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

// 🔧 FIXED: Entity-Namen für Autocomplete suchen
    async searchEntityNames(entityType, searchTerm = '', db = 'memgraph', limit = 100) {
        // ✅ FIXED: Korrekte Route verwenden
        const response = await api.get(`/entity/${entityType}/search`, {
            params: {
                q: searchTerm,  // Kann leer sein für "alle Entities" 
                db,
                limit
            }
        });
        return response.data;
    }

// 🆕 ZUSÄTZLICHE METHODE: Alle Entities eines Typs laden
    async getAllEntitiesOfType(entityType, db = 'memgraph', limit = 100) {
        // Leerer Suchterm = alle Entities
        return this.searchEntityNames(entityType, '', db, limit);
    }    
    
// Raw Query ausführen (falls später benötigt)
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