// src/services/api.js - Backend API Service (React 19 kompatibel)
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

    // Entity Operations - mit source parameter (oracle/memgraph/both)
    async getEntities(entityType, params = {}) {
        const { source = 'both', limit = 100, search } = params;
        const queryParams = new URLSearchParams({ source, limit });

        if (search) {
            queryParams.append('search', search);
        }

        const response = await api.get(`/${entityType}?${queryParams}`);
        return response.data;
    }

    // Einzelne Entity abrufen
    async getEntity(entityType, id, source = 'memgraph') {
        const response = await api.get(`/${entityType}/${id}?source=${source}`);
        return response.data;
    }

    // Relationships einer Entity
    async getEntityRelationships(entityType, id, relationshipType, source = 'memgraph') {
        const response = await api.get(`/${entityType}/${id}/${relationshipType}?source=${source}`);
        return response.data;
    }

    // Global Search
    async globalSearch(query, entityType = null, source = 'both', limit = 10) {
        const params = new URLSearchParams({ q: query, source, limit });
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
}

// Singleton Export
const apiService = new ApiService();
export default apiService;