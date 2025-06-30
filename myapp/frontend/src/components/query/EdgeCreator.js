// src/components/query/EdgeCreator.js - CREATE Edge Interface
import React, { useState, useEffect } from 'react';
import { Link, Save, RefreshCw, CheckCircle, AlertCircle, ArrowRight } from 'lucide-react';
import apiService from '../../services/api';
import EntityDropdown from './shared/EntityDropdown';

const EdgeCreator = () => {
    const [database, setDatabase] = useState('memgraph');
    const [relationshipType, setRelationshipType] = useState('WORKS_IN');
    const [sourceEntityType, setSourceEntityType] = useState('person');
    const [sourceEntityName, setSourceEntityName] = useState('');
    const [targetEntityType, setTargetEntityType] = useState('field');
    const [targetEntityName, setTargetEntityName] = useState('');
    const [edgeProperties, setEdgeProperties] = useState({});

    const [entityConfigs, setEntityConfigs] = useState({});
    const [edgeConfigs, setEdgeConfigs] = useState({});
    const [availableEdgeTypes, setAvailableEdgeTypes] = useState([]);

    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState('');
    const [validationError, setValidationError] = useState('');

    // Konfigurationen laden
    useEffect(() => {
        const loadConfigs = async () => {
            try {
                const configs = await apiService.getEntityConfigurations();
                setEntityConfigs(configs.entityConfigs || {});
                setEdgeConfigs(configs.edgeConfigs || {});
                setAvailableEdgeTypes(configs.edgeTypes || []);
            } catch (err) {
                console.error('Failed to load configs:', err);
            }
        };
        loadConfigs();
    }, []);

    // Relationship Type geändert - passende Entity Types setzen
    useEffect(() => {
        if (edgeConfigs[relationshipType]) {
            const config = edgeConfigs[relationshipType];
            setSourceEntityType(config.source_type);
            setTargetEntityType(config.target_type);
            setEdgeProperties({});
        }
        setValidationError('');
        setError('');
        setResult(null);
    }, [relationshipType, edgeConfigs]);

    // Aktuelle Edge-Konfiguration
    const currentEdgeConfig = edgeConfigs[relationshipType] || {};
    const availableProperties = currentEdgeConfig.properties || [];

    // Property-Änderung
    const handlePropertyChange = (property, value) => {
        setEdgeProperties(prev => ({
            ...prev,
            [property]: value
        }));
    };

    // Source Entity ID aus Name ermitteln - MIT DEBUGGING
    const getEntityIdByName = async (entityType, entityName, db) => {
        try {
            console.log(`🔍 Looking up entity: ${entityType}:${entityName} in ${db}`);

            const searchResult = await apiService.searchEntityNames(entityType, entityName, db, 10);
            console.log(`🔍 Search result for ${entityName}:`, searchResult);

            if (searchResult.success && searchResult.data.results.length > 0) {
                // Suche nach exakter Übereinstimmung
                const exactMatch = searchResult.data.results.find(entity => {
                    const entityName_from_result = db === 'oracle'
                        ? (entity.NAME || entity.name)
                        : (entity['e.name'] || entity.name);
                    return entityName_from_result === entityName;
                });

                const entity = exactMatch || searchResult.data.results[0];
                console.log(`🔍 Selected entity for ${entityName}:`, entity);

                // Wikidata ID extrahieren
                let wikidataId;
                if (db === 'oracle') {
                    wikidataId = entity.id || entity.ID;
                } else {
                    wikidataId = entity['e.id'] || entity.id;
                }

                console.log(`🔍 Extracted Wikidata ID for ${entityName}: ${wikidataId}`);
                return wikidataId;
            }

            console.warn(`⚠️ No results found for ${entityType}:${entityName} in ${db}`);
            return null;
        } catch (err) {
            console.error(`❌ Failed to get entity ID for ${entityName}:`, err);
            return null;
        }
    };

    // Validation
    const validateForm = () => {
        if (!relationshipType) {
            setValidationError('Relationship type is required');
            return false;
        }

        if (!sourceEntityName.trim()) {
            setValidationError('Source entity name is required');
            return false;
        }

        if (!targetEntityName.trim()) {
            setValidationError('Target entity name is required');
            return false;
        }

        if (sourceEntityName.trim() === targetEntityName.trim() && sourceEntityType === targetEntityType) {
            setValidationError('Source and target entities must be different');
            return false;
        }

        setValidationError('');
        return true;
    };

    // Edge erstellen
    const createEdge = async () => {
        if (!validateForm()) return;

        setLoading(true);
        setError('');
        setResult(null);

        try {
            // Entity IDs ermitteln
            console.log('Looking up entity IDs...');

            const [sourceId, targetId] = await Promise.all([
                getEntityIdByName(sourceEntityType, sourceEntityName, database),
                getEntityIdByName(targetEntityType, targetEntityName, database)
            ]);

            if (!sourceId) {
                throw new Error(`❌ Source entity "${sourceEntityName}" (${sourceEntityType}) not found in ${database}. Make sure the entity exists and the name is spelled correctly.`);
            }

            if (!targetId) {
                throw new Error(`❌ Target entity "${targetEntityName}" (${targetEntityType}) not found in ${database}. Make sure the entity exists and the name is spelled correctly.`);
            }

            console.log(`Found IDs: ${sourceEntityName} -> ${sourceId}, ${targetEntityName} -> ${targetId}`);

            // Edge Data zusammenstellen
            const edgeData = {
                relationshipType,
                sourceEntityType, // 🔧 Sicherstellen dass diese Werte gesetzt sind
                sourceId,
                targetEntityType,
                targetId,
                properties: edgeProperties
            };


            console.log('🔧 Final edge data before API call:', edgeData);
            console.log('🔧 Source Entity Type:', sourceEntityType);
            console.log('🔧 Target Entity Type:', targetEntityType);
            
            

            console.log('Creating edge:', edgeData);

            console.log('🔧 DEBUG sourceEntityType:', sourceEntityType);
            console.log('🔧 DEBUG typeof sourceEntityType:', typeof sourceEntityType);
            console.log('🔧 DEBUG edgeData.sourceEntityType:', edgeData.sourceEntityType);

// Falls sourceEntityType undefined/falsch ist:
            if (!sourceEntityType || sourceEntityType === 'edge') {
                console.log('🔧 FIXING sourceEntityType to person');
                edgeData.sourceEntityType = 'person';
            }
            
            // 🔧 DEBUG: Direct api test  
            console.log('🔧 TESTING DIRECT API CALL...');
            try {
                const { default: axios } = await import('axios');
                const directTest = await axios.post(
                    'http://c017-master.infcs.de:10510/api/entity/edge/create?db=memgraph',
                    edgeData,
                    {
                        headers: { 'Content-Type': 'application/json' },
                        timeout: 10000
                    }
                );
                console.log('🔧 DIRECT SUCCESS:', directTest.data);
            } catch (directError) {
                console.log('🔧 DIRECT ERROR:', directError.response?.data || directError.message);
                console.log('🔧 DIRECT ERROR STATUS:', directError.response?.status);
            }
            
            const response = await apiService.createEdge(edgeData, database);

            setResult(response);

            // Form teilweise zurücksetzen
            setSourceEntityName('');
            setTargetEntityName('');
            setEdgeProperties({});

        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // Property-spezifische Input-Komponente
    const renderPropertyField = (property) => {
        const value = edgeProperties[property] || '';

        if (property.includes('date')) {
            return (
                <div key={property} className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                        {property.replace('_', ' ').toUpperCase()}
                    </label>
                    <input
                        type="date"
                        value={value}
                        onChange={(e) => handlePropertyChange(property, e.target.value)}
                        className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                </div>
            );
        }

        return (
            <div key={property} className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                    {property.replace('_', ' ').toUpperCase()}
                </label>
                <input
                    type="text"
                    value={value}
                    onChange={(e) => handlePropertyChange(property, e.target.value)}
                    placeholder={`Enter ${property.replace('_', ' ')}...`}
                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
            </div>
        );
    };

    return (
        <div className="bg-white rounded-lg border p-6">
            <div className="flex items-center gap-3 mb-6">
                <Link className="text-blue-600" size={24} />
                <div>
                    <h3 className="text-lg font-semibold text-gray-900">Neue Beziehung erstellen</h3>
                    <p className="text-gray-600">Verbinde zwei existierende Entities mit einer Beziehung</p>
                </div>
            </div>

            {/* Database Selection */}
            <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Database</label>
                <select
                    value={database}
                    onChange={(e) => setDatabase(e.target.value)}
                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 max-w-md"
                >
                    <option value="memgraph">🔵 Memgraph (Cypher)</option>
                    <option value="oracle">🔴 Oracle (PGQL)</option>
                </select>
            </div>

            {/* Relationship Type Selection */}
            <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Relationship Type</label>
                <select
                    value={relationshipType}
                    onChange={(e) => setRelationshipType(e.target.value)}
                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                    {availableEdgeTypes.map(edgeType => (
                        <option key={edgeType} value={edgeType}>
                            {edgeType}
                            {edgeConfigs[edgeType] && (
                                ` (${edgeConfigs[edgeType].source_type} → ${edgeConfigs[edgeType].target_type})`
                            )}
                        </option>
                    ))}
                </select>

                {currentEdgeConfig.source_type && (
                    <p className="text-sm text-gray-500 mt-1">
                        🔗 Connects: <strong>{currentEdgeConfig.source_type}</strong> → <strong>{currentEdgeConfig.target_type}</strong>
                    </p>
                )}
            </div>

            {/* Source and Target Entity Selection */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                {/* Source Entity */}
                <div className="space-y-4">
                    <h4 className="font-medium text-gray-900 flex items-center gap-2">
                        📤 Source Entity
                    </h4>

                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">Entity Type</label>
                        <select
                            value={sourceEntityType}
                            onChange={(e) => setSourceEntityType(e.target.value)}
                            disabled={currentEdgeConfig.source_type}
                            className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                        >
                            <option value="person">👤 Person</option>
                            <option value="place">📍 Place</option>
                            <option value="work">📚 Work</option>
                            <option value="award">🏆 Award</option>
                            <option value="field">🔬 Field</option>
                            <option value="occupation">💼 Occupation</option>
                            <option value="workplace">🏢 Workplace</option>
                        </select>
                    </div>

                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">Entity Name</label>
                        <EntityDropdown
                            value={sourceEntityName}
                            onChange={setSourceEntityName}
                            entityType={sourceEntityType}
                            database="both"
                            showDatabaseIndicator={true}
                            placeholder={`Select ${sourceEntityType}...`}
                        />
                    </div>
                </div>

                {/* Arrow */}
                <div className="flex items-center justify-center lg:pt-16">
                    <div className="flex items-center gap-2 text-blue-600">
                        <ArrowRight size={24} />
                        <span className="text-sm font-medium">{relationshipType}</span>
                    </div>
                </div>

                {/* Target Entity */}
                <div className="space-y-4">
                    <h4 className="font-medium text-gray-900 flex items-center gap-2">
                        📥 Target Entity
                    </h4>

                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">Entity Type</label>
                        <select
                            value={targetEntityType}
                            onChange={(e) => setTargetEntityType(e.target.value)}
                            disabled={currentEdgeConfig.target_type}
                            className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                        >
                            <option value="person">👤 Person</option>
                            <option value="place">📍 Place</option>
                            <option value="work">📚 Work</option>
                            <option value="award">🏆 Award</option>
                            <option value="field">🔬 Field</option>
                            <option value="occupation">💼 Occupation</option>
                            <option value="workplace">🏢 Workplace</option>
                        </select>
                    </div>

                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">Entity Name</label>
                        <EntityDropdown
                            value={targetEntityName}
                            onChange={setTargetEntityName}
                            entityType={targetEntityType}
                            database="both"
                            showDatabaseIndicator={true}
                            placeholder={`Select ${targetEntityType}...`}
                        />
                    </div>
                </div>
            </div>

            {/* Edge Properties */}
            {availableProperties.length > 0 && (
                <div className="mb-6">
                    <h4 className="font-medium text-gray-900 mb-4">Relationship Properties (Optional)</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {availableProperties.map(property => renderPropertyField(property))}
                    </div>
                </div>
            )}

            {/* Validation Error */}
            {validationError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-center gap-2">
                    <AlertCircle size={16} />
                    {validationError}
                </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 mb-6">
                <button
                    onClick={createEdge}
                    disabled={loading || !sourceEntityName || !targetEntityName}
                    className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {loading ? (
                        <>
                            <RefreshCw size={16} className="animate-spin" />
                            Creating...
                        </>
                    ) : (
                        <>
                            <Save size={16} />
                            Create Relationship
                        </>
                    )}
                </button>

                <button
                    onClick={() => {
                        setSourceEntityName('');
                        setTargetEntityName('');
                        setEdgeProperties({});
                        setValidationError('');
                        setError('');
                        setResult(null);
                    }}
                    className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                    Reset Form
                </button>
            </div>

            {/* Success Result */}
            {result && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center gap-2 mb-3">
                        <CheckCircle className="text-green-600" size={20} />
                        <h4 className="font-medium text-green-900">✅ Relationship created successfully!</h4>
                    </div>

                    <div className="space-y-2 text-sm">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <strong>Relationship:</strong> {result.data?.edge?.relationshipType}
                            </div>
                            <div>
                                <strong>Database:</strong> {result.data?.database}
                            </div>
                            <div>
                                <strong>Source:</strong> {result.data?.edge?.sourceId}
                            </div>
                            <div>
                                <strong>Target:</strong> {result.data?.edge?.targetId}
                            </div>
                        </div>

                        {result.data?.edge && (
                            <div className="mt-3 p-3 bg-white border rounded text-xs">
                                <strong>Created Edge:</strong>
                                <pre className="mt-1 overflow-x-auto">
                                    {JSON.stringify(result.data.edge, null, 2)}
                                </pre>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Error Display */}
            {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                        <AlertCircle className="text-red-600" size={20} />
                        <h4 className="font-medium text-red-900">❌ Creation failed</h4>
                    </div>
                    <p className="text-red-700 text-sm">{error}</p>
                </div>
            )}

            {/* Info Box */}
            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm">
                <h5 className="font-medium text-blue-900 mb-2">💡 Usage Tips:</h5>
                <ul className="text-blue-800 space-y-1">
                    <li>• Select a <strong>relationship type</strong> first to auto-configure entity types</li>
                    <li>• Entity names must exist in the selected database</li>
                    <li>• <strong>Oracle</strong> creates edges via base tables, <strong>Memgraph</strong> via Cypher</li>
                    <li>• Properties like dates are optional and relationship-specific</li>
                    <li>• Different relationship types connect different entity types</li>
                </ul>
            </div>
        </div>
    );
};

export default EdgeCreator;