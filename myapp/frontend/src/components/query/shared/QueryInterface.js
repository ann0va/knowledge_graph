// =============================================================================
// 1. 📁 src/components/query/shared/QueryInterface.js - BASE INTERFACE
// =============================================================================

import React, { useState } from 'react';
import apiService from '../../../services/api';

/**
 * Base Query Interface - Gemeinsame Funktionalität für alle Query-Typen
 */
export class QueryInterface {
    constructor() {
        this.queryResults = null;
        this.queryLoading = false;
        this.queryError = null;
        this.validationError = '';
    }

    // Gemeinsame Entity-Loading Logik
    async loadEntitiesForDropdown(entityType, limit = 100) {
        try {
            console.log(`🔄 Loading entities for dropdown: ${entityType}`);
            const result = await apiService.searchEntityNames(entityType, '', 'memgraph', limit);

            if (result.success && result.data.suggestions) {
                console.log(`✅ Loaded ${result.data.suggestions.length} entities for ${entityType}`);
                return result.data.suggestions;
            } else {
                // Fallback auf Mock-Daten
                const mockData = this.getMockEntities(entityType);
                console.warn(`⚠️ Using mock data for ${entityType}`);
                return mockData;
            }
        } catch (error) {
            console.error(`❌ Entity loading error for ${entityType}:`, error);
            return this.getMockEntities(entityType);
        }
    }

    // Mock-Daten für Fallback
    getMockEntities(entityType) {
        const entities = {
            person: ['Alan Turing', 'Beatrice Helen Worsley', 'Alonzo Church', 'Christopher Morcom'],
            award: ['Turing Award', 'Nobel Prize', 'IEEE Medal'],
            field: ['Computer Science', 'Mathematics', 'Cryptography'],
            place: ['London', 'Cambridge', 'Manchester'],
            work: ['On Computable Numbers', 'Computing Machinery and Intelligence'],
            workplace: ['University of Cambridge', 'Princeton University'],
            occupation: ['Computer Scientist', 'Mathematician', 'Cryptographer']
        };
        return entities[entityType] || [];
    }

    // Gemeinsame Query-Ausführung
    async executeQuery(queryData) {
        try {
            console.log('🚀 Executing query:', queryData);
            const result = await apiService.executeStructuredQuery(queryData);

            if (result.success) {
                console.log('✅ Query results:', result);
                return { success: true, data: result };
            } else {
                return { success: false, error: result.error || 'Query execution failed' };
            }
        } catch (error) {
            console.error('❌ Query execution error:', error);
            return { success: false, error: error.message };
        }
    }

    // Gemeinsame Validation-Helper
    validateNotEmpty(value, fieldName) {
        if (!value || value.trim() === '') {
            return `${fieldName} ist erforderlich`;
        }
        return null;
    }

    validateEntitiesDifferent(entity1, entity2, type1, type2) {
        if (entity1 === entity2 && type1 === type2) {
            return 'Start- und Ziel-Entity müssen unterschiedlich sein';
        }
        return null;
    }
}