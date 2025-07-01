// src/components/query/shared/EntityDropdown.js - ENHANCED with multi-database support
import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, Search, Database } from 'lucide-react';
import apiService from '../../../services/api';

const EntityDropdown = ({
                            value,
                            onChange,
                            entityType,
                            placeholder = "Select entity...",
                            database = 'both', // 'both', 'memgraph', 'oracle'
                            showDatabaseIndicator = true,
                            limit = 100
                        }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [options, setOptions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const dropdownRef = useRef(null);

    // Dropdown schließen bei Klick außerhalb
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Entities laden
    const loadEntities = async (searchQuery = '') => {
        setLoading(true);
        setError('');

        try {
            let combinedResults = [];

            if (database === 'both') {
                // 🔄 BEIDE DATENBANKEN: Parallel laden und kombinieren
                const [memgraphResult, oracleResult] = await Promise.allSettled([
                    apiService.searchEntityNames(entityType, searchQuery, 'memgraph', limit),
                    apiService.searchEntityNames(entityType, searchQuery, 'oracle', limit)
                ]);

                // Memgraph Results verarbeiten
                if (memgraphResult.status === 'fulfilled' && memgraphResult.value.success) {
                    const memgraphEntities = memgraphResult.value.data.results.map(entity => ({
                        id: entity['e.id'] || entity.id,
                        name: entity['e.name'] || entity.name,
                        database: 'memgraph',
                        rawEntity: entity
                    }));
                    combinedResults = [...combinedResults, ...memgraphEntities];
                }

                // Oracle Results verarbeiten
                if (oracleResult.status === 'fulfilled' && oracleResult.value.success) {
                    const oracleEntities = oracleResult.value.data.results.map(entity => ({
                        id: entity.id || entity.ID || (entity.VERTEX_ID && entity.VERTEX_ID.match(/\(([^)]+)\)/)?.[1]),
                        name: entity.NAME || entity.name,
                        database: 'oracle',
                        rawEntity: entity
                    }));
                    combinedResults = [...combinedResults, ...oracleEntities];
                }

                // 🔧 DEDUPLIZIERUNG: Entities die in beiden DBs existieren zusammenfassen
                const entityMap = new Map();
                combinedResults.forEach(entity => {
                    if (entity.id && entity.name) {
                        const key = `${entity.id}_${entity.name}`;
                        if (entityMap.has(key)) {
                            // Entity existiert bereits - databases array erweitern
                            const existing = entityMap.get(key);
                            if (!existing.databases.includes(entity.database)) {
                                existing.databases.push(entity.database);
                            }
                        } else {
                            // Neue Entity
                            entityMap.set(key, {
                                ...entity,
                                databases: [entity.database]
                            });
                        }
                    }
                });

                combinedResults = Array.from(entityMap.values());

            } else {
                // 🎯 EINZELNE DATENBANK
                const result = await apiService.searchEntityNames(entityType, searchQuery, database, limit);

                if (result.success) {
                    combinedResults = result.data.results.map(entity => {
                        const id = database === 'oracle' ? (entity.id || entity.ID) : (entity['e.id'] || entity.id);
                        const name = database === 'oracle' ? (entity.NAME || entity.name) : (entity['e.name'] || entity.name);

                        return {
                            id,
                            name,
                            database,
                            databases: [database],
                            rawEntity: entity
                        };
                    });
                }
            }

            // Nach Name sortieren
            combinedResults.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

            setOptions(combinedResults);

        } catch (err) {
            console.error('Failed to load entities:', err);
            setError('Failed to load entities');
        } finally {
            setLoading(false);
        }
    };

    // 🔧 GERMAN LABELS: Entity Type Labels
    const getEntityTypeLabel = (type) => {
        const labels = {
            'person': '👤 Person',
            'place': '📍 Ort',
            'work': '📚 Werk',
            'award': '🏆 Auszeichnung',
            'field': '🔬 Fachbereich',
            'occupation': '💼 Beruf',
            'workplace': '🏢 Arbeitsplatz'
        };
        return labels[type] || type;
    };

    // Initial load und search handling
    useEffect(() => {
        if (isOpen) {
            loadEntities(searchTerm);
        }
    }, [isOpen, searchTerm, entityType, database]);

    // Database Indicator Component
    const DatabaseIndicator = ({ databases }) => {
        const hasMemgraph = databases.includes('memgraph');
        const hasOracle = databases.includes('oracle');

        if (hasMemgraph && hasOracle) {
            return (
                <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                </div>
            );
        } else if (hasMemgraph) {
            return <div className="w-2 h-2 bg-blue-500 rounded-full"></div>;
        } else if (hasOracle) {
            return <div className="w-2 h-2 bg-red-500 rounded-full"></div>;
        }
        return null;
    };

    // Option auswählen
    const selectOption = (option) => {
        onChange(option.name);
        setIsOpen(false);
        setSearchTerm('');
    };

    // Filtered options basierend auf search
    const filteredOptions = options.filter(option =>
        option.name && option.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Main Input */}
            <div
                onClick={() => setIsOpen(!isOpen)}
                className="w-full p-3 border rounded-lg cursor-pointer bg-white hover:border-gray-400 focus:ring-2 focus:ring-blue-500 flex items-center justify-between"
            >
                <span className={value ? 'text-gray-900' : 'text-gray-500'}>
                    {value || placeholder}
                </span>
                <div className="flex items-center gap-2">
                    {/* Database Status Indicator */}
                    {database === 'both' && (
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                            <Database size={12} />
                            <span>Both</span>
                        </div>
                    )}
                    <ChevronDown size={16} className={`transform transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </div>
            </div>

            {/* Dropdown Menu */}
            {isOpen && (
                <div className="absolute z-50 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-80 overflow-hidden">
                    {/* Search Box */}
                    <div className="p-3 border-b">
                        <div className="relative">
                            <Search size={16} className="absolute left-3 top-3 text-gray-400" />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder={`${getEntityTypeLabel(entityType)} durchsuchen`}
                                className="w-full pl-10 pr-4 py-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                autoFocus
                            />
                        </div>

                        {/* Database Info */}
                        {database === 'both' && (
                            <div className="mt-2 flex items-center gap-4 text-xs text-gray-600">
                                <div className="flex items-center gap-1">
                                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                    <span>Memgraph</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                                    <span>Oracle</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                    <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                                    <span>Both</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Options List */}
                    <div className="max-h-60 overflow-y-auto">
                        {loading ? (
                            <div className="p-4 text-center text-gray-500">
                                <div className="animate-spin w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-2"></div>
                                Loading entities...
                            </div>
                        ) : error ? (
                            <div className="p-4 text-center text-red-500">
                                {error}
                            </div>
                        ) : filteredOptions.length === 0 ? (
                            <div className="p-4 text-center text-gray-500">
                                No {entityType} found
                                {searchTerm && ` matching "${searchTerm}"`}
                            </div>
                        ) : (
                            filteredOptions.map((option, index) => (
                                <div
                                    key={`${option.id}_${option.databases.join('_')}_${index}`}
                                    onClick={() => selectOption(option)}
                                    className="px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                                >
                                    <div className="flex items-center gap-3">
                                        {/* Database Indicator */}
                                        {showDatabaseIndicator && (
                                            <DatabaseIndicator databases={option.databases} />
                                        )}

                                        {/* Entity Info */}
                                        <div className="flex-1 min-w-0">
                                            <div className="font-medium text-gray-900 truncate">
                                                {option.name}
                                            </div>
                                            <div className="text-sm text-gray-500 truncate">
                                                ID: {option.id}
                                                {/*{option.databases.length > 1 && (*/}
                                                {/*    <span className="ml-2 text-green-600 font-medium">*/}
                                                {/*        (Available in both databases)*/}
                                                {/*    </span>*/}
                                                {/*)}*/}
                                            </div>
                                        </div>

                                        {/* Database Labels */}
                                        <div className="flex gap-1">
                                            {option.databases.map(db => (
                                                <span
                                                    key={db}
                                                    className={`px-2 py-1 text-xs rounded-full ${
                                                        db === 'memgraph'
                                                            ? 'bg-blue-100 text-blue-800'
                                                            : 'bg-red-100 text-red-800'
                                                    }`}
                                                >
                                                    {db === 'memgraph' ? 'MG' : 'OR'}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Footer with count */}
                    {!loading && !error && (
                        <div className="p-2 border-t bg-gray-50 text-xs text-gray-600 text-center">
                            {filteredOptions.length} {entityType}{filteredOptions.length !== 1 ? 's' : ''} found
                            {database === 'both' && ` from both databases`}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default EntityDropdown;