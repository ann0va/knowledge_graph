// src/components/query/EdgeDeleter.js - ENHANCED for multi-database support
import React, { useState, useEffect } from 'react';
import { Unlink, Search, AlertTriangle, CheckCircle, AlertCircle, RefreshCw, ArrowRight } from 'lucide-react';
import apiService from '../../services/api';
import EntityDropdown from './shared/EntityDropdown';

const EdgeDeleter = () => {
    const [database, setDatabase] = useState('memgraph');
    const [relationshipType, setRelationshipType] = useState('WORKS_IN');
    const [sourceEntityType, setSourceEntityType] = useState('person');
    const [sourceEntityName, setSourceEntityName] = useState('');
    const [sourceId, setSourceId] = useState('');
    const [targetEntityType, setTargetEntityType] = useState('field');
    const [targetEntityName, setTargetEntityName] = useState('');
    const [targetId, setTargetId] = useState('');

    const [edgeConfigs, setEdgeConfigs] = useState({});
    const [availableEdgeTypes, setAvailableEdgeTypes] = useState([]);

    const [edgeInfo, setEdgeInfo] = useState(null);
    const [loading, setLoading] = useState(false);
    const [searching, setSearching] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState('');

    // Konfigurationen laden
    useEffect(() => {
        const loadConfigs = async () => {
            try {
                const configs = await apiService.getEntityConfigurations();
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
        }
        resetForm();
    }, [relationshipType, edgeConfigs]);

    // Database geändert - Form zurücksetzen
    useEffect(() => {
        resetForm();
    }, [database]);

    const resetForm = () => {
        setSourceEntityName('');
        setSourceId('');
        setTargetEntityName('');
        setTargetId('');
        setEdgeInfo(null);
        setError('');
        setResult(null);
    };

    // 🔧 ENHANCED: Entity ID aus gewählter Datenbank extrahieren
    const getEntityIdByName = async (entityType, entityName) => {
        try {
            console.log(`🔍 Looking up entity: ${entityType}:${entityName} for ${database}`);

            // Zuerst in der Ziel-Datenbank suchen
            let extractedId = null;

            const searchResult = await apiService.searchEntityNames(entityType, entityName, database, 10);

            if (searchResult.success && searchResult.data.results.length > 0) {
                const exactMatch = searchResult.data.results.find(entity => {
                    const entityNameFromResult = database === 'oracle'
                        ? (entity.NAME || entity.name)
                        : (entity['e.name'] || entity.name);
                    return entityNameFromResult === entityName;
                });

                const entity = exactMatch || searchResult.data.results[0];

                if (database === 'oracle') {
                    extractedId = entity.id || entity.ID;
                } else {
                    extractedId = entity['e.id'] || entity.id;
                }
            }

            // Falls nicht in Ziel-DB gefunden, in der anderen DB suchen
            if (!extractedId) {
                const fallbackDb = database === 'oracle' ? 'memgraph' : 'oracle';
                console.log(`🔄 Fallback: Searching in ${fallbackDb}...`);

                const fallbackResult = await apiService.searchEntityNames(entityType, entityName, fallbackDb, 10);

                if (fallbackResult.success && fallbackResult.data.results.length > 0) {
                    const exactMatch = fallbackResult.data.results.find(entity => {
                        const entityNameFromResult = fallbackDb === 'oracle'
                            ? (entity.NAME || entity.name)
                            : (entity['e.name'] || entity.name);
                        return entityNameFromResult === entityName;
                    });

                    const entity = exactMatch || fallbackResult.data.results[0];

                    if (fallbackDb === 'oracle') {
                        extractedId = entity.id || entity.ID;
                    } else {
                        extractedId = entity['e.id'] || entity.id;
                    }

                    if (extractedId) {
                        console.log(`⚠️ Warning: Entity found in ${fallbackDb} but target is ${database}`);
                    }
                }
            }

            console.log(`🔍 Extracted ID for ${entityName}: ${extractedId}`);
            return extractedId;
        } catch (err) {
            console.error(`Failed to get entity ID for ${entityName}:`, err);
            return null;
        }
    };

    // Source Entity Name geändert - ID extrahieren
    const handleSourceEntityChange = async (entityName) => {
        setSourceEntityName(entityName);
        setSourceId('');

        if (entityName.trim() === '') return;

        try {
            const id = await getEntityIdByName(sourceEntityType, entityName);
            if (id) setSourceId(id);
        } catch (err) {
            console.warn('Could not extract source entity ID:', err);
        }
    };

    // Target Entity Name geändert - ID extrahieren
    const handleTargetEntityChange = async (entityName) => {
        setTargetEntityName(entityName);
        setTargetId('');

        if (entityName.trim() === '') return;

        try {
            const id = await getEntityIdByName(targetEntityType, entityName);
            if (id) setTargetId(id);
        } catch (err) {
            console.warn('Could not extract target entity ID:', err);
        }
    };

    // Edge für Deletion suchen
    const searchEdgeForDeletion = async () => {
        if (!sourceId || !targetId) {
            setError('Please select both source and target entities');
            return;
        }

        setSearching(true);
        setError('');
        setEdgeInfo(null);

        try {
            const info = await apiService.findEdgeForDeletion(relationshipType, sourceId, targetId, database);

            if (info.success) {
                setEdgeInfo(info);
            } else {
                setError(info.error || `Edge not found in ${database}`);
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setSearching(false);
        }
    };

    // Edge löschen
    const deleteEdge = async () => {
        if (!edgeInfo) {
            setError('Please search for an edge first');
            return;
        }

        setDeleting(true);
        setError('');
        setResult(null);

        try {
            const edgeData = {
                relationshipType,
                sourceId,
                targetId
            };

            const deleteResult = await apiService.deleteEdge(edgeData, database);
            setResult(deleteResult);

            // Form zurücksetzen nach erfolgreichem Löschen
            resetForm();

        } catch (err) {
            setError(err.message);
        } finally {
            setDeleting(false);
        }
    };

    // Aktuelle Edge-Konfiguration
    const currentEdgeConfig = edgeConfigs[relationshipType] || {};

    return (
        <div className="bg-white rounded-lg border p-6">
            <div className="flex items-center gap-3 mb-6">
                <Unlink className="text-red-600" size={24} />
                <div>
                    <h3 className="text-lg font-semibold text-gray-900">Beziehung löschen</h3>
                    <p className="text-gray-600">Lösche eine spezifische Beziehung zwischen zwei Entities</p>
                </div>
            </div>

            {/* Database Selection */}
            <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Target Database</label>
                <select
                    value={database}
                    onChange={(e) => setDatabase(e.target.value)}
                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 max-w-md"
                >
                    <option value="memgraph">🔵 Memgraph (Cypher)</option>
                    <option value="oracle">🔴 Oracle (PGQL)</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                    Dropdown shows entities from both databases, but deletion targets only the selected database.
                </p>
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
                        🔗 Removes: <strong>{currentEdgeConfig.source_type}</strong> → <strong>{currentEdgeConfig.target_type}</strong>
                    </p>
                )}
            </div>

            {/* Source and Target Entity Selection - ENHANCED */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                {/* Source Entity */}
                <div className="space-y-4">
                    <h4 className="font-medium text-gray-900 flex items-center gap-2">
                        📤 Source Entity
                    </h4>

                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">Entity Type</label>
                        <input
                            type="text"
                            value={sourceEntityType}
                            disabled
                            className="w-full p-3 border rounded-lg bg-gray-100 text-gray-600"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">
                            Entity Name
                            <span className="text-sm text-gray-500 ml-1">(from both databases)</span>
                        </label>
                        <EntityDropdown
                            value={sourceEntityName}
                            onChange={handleSourceEntityChange}
                            entityType={sourceEntityType}
                            database="both" // 🔧 FIXED: Immer beide DBs anzeigen
                            placeholder={`Select ${sourceEntityType}...`}
                            showDatabaseIndicator={true}
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">Wikidata ID</label>
                        <input
                            type="text"
                            value={sourceId}
                            onChange={(e) => setSourceId(e.target.value)}
                            placeholder="Q1234567890"
                            className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                </div>

                {/* Arrow */}
                <div className="flex items-center justify-center lg:pt-16">
                    <div className="flex items-center gap-2 text-red-600">
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
                        <input
                            type="text"
                            value={targetEntityType}
                            disabled
                            className="w-full p-3 border rounded-lg bg-gray-100 text-gray-600"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">
                            Entity Name
                            <span className="text-sm text-gray-500 ml-1">(from both databases)</span>
                        </label>
                        <EntityDropdown
                            value={targetEntityName}
                            onChange={handleTargetEntityChange}
                            entityType={targetEntityType}
                            database="both" // 🔧 FIXED: Immer beide DBs anzeigen
                            placeholder={`Select ${targetEntityType}...`}
                            showDatabaseIndicator={true}
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">Wikidata ID</label>
                        <input
                            type="text"
                            value={targetId}
                            onChange={(e) => setTargetId(e.target.value)}
                            placeholder="Q1234567890"
                            className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                </div>
            </div>

            {/* Database Info */}
            <div className="mb-6 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm">
                <div className="flex items-center gap-2 text-blue-800">
                    <span>🔵 = Memgraph, 🔴 = Oracle, 🔵🔴 = Both databases</span>
                </div>
                <p className="text-blue-700 mt-1">
                    Edge will be deleted from <strong>{database}</strong> only, even if entities exist in both databases.
                </p>
            </div>

            {/* Search Button */}
            <div className="flex gap-3 mb-6">
                <button
                    onClick={searchEdgeForDeletion}
                    disabled={searching || !sourceId || !targetId}
                    className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {searching ? (
                        <>
                            <RefreshCw size={16} className="animate-spin" />
                            Searching in {database}...
                        </>
                    ) : (
                        <>
                            <Search size={16} />
                            Search Edge in {database}
                        </>
                    )}
                </button>
            </div>

            {/* Edge Information */}
            {edgeInfo && (
                <div className="mb-6 p-4 border rounded-lg bg-gray-50">
                    <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                        <Search size={16} />
                        Edge found in {database}
                    </h4>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                            <strong>Relationship:</strong> {edgeInfo.edgeInfo.relationshipType}
                        </div>
                        <div>
                            <strong>Target Database:</strong>
                            <span className={`ml-2 px-2 py-1 text-xs rounded ${
                                database === 'memgraph'
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-red-100 text-red-800'
                            }`}>
                                {database === 'memgraph' ? '🔵 Memgraph' : '🔴 Oracle'}
                            </span>
                        </div>
                        <div>
                            <strong>Source:</strong> {edgeInfo.edgeInfo.sourceEntity?.name || sourceId} ({edgeInfo.edgeInfo.sourceType})
                        </div>
                        <div>
                            <strong>Target:</strong> {edgeInfo.edgeInfo.targetEntity?.name || targetId} ({edgeInfo.edgeInfo.targetType})
                        </div>
                    </div>

                    {/* Deletion Warning */}
                    <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-2">
                        <AlertTriangle size={16} className="text-yellow-600 mt-0.5" />
                        <div className="text-sm text-yellow-800">
                            <p>{edgeInfo.deletionWarning}</p>
                            <p className="mt-1">This edge will be deleted from <strong>{database}</strong> only.</p>
                        </div>
                    </div>

                    {/* Entity Details */}
                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                        {edgeInfo.edgeInfo.sourceEntity && (
                            <div className="p-3 bg-white border rounded text-xs">
                                <strong>Source Entity:</strong>
                                <pre className="mt-1 overflow-x-auto text-gray-600">
                                    {JSON.stringify(edgeInfo.edgeInfo.sourceEntity, null, 2)}
                                </pre>
                            </div>
                        )}

                        {edgeInfo.edgeInfo.targetEntity && (
                            <div className="p-3 bg-white border rounded text-xs">
                                <strong>Target Entity:</strong>
                                <pre className="mt-1 overflow-x-auto text-gray-600">
                                    {JSON.stringify(edgeInfo.edgeInfo.targetEntity, null, 2)}
                                </pre>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 mb-6">
                <button
                    onClick={deleteEdge}
                    disabled={deleting || !edgeInfo}
                    className="flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {deleting ? (
                        <>
                            <RefreshCw size={16} className="animate-spin" />
                            Deleting from {database}...
                        </>
                    ) : (
                        <>
                            <Unlink size={16} />
                            Delete Edge from {database}
                        </>
                    )}
                </button>

                <button
                    onClick={resetForm}
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
                        <h4 className="font-medium text-green-900">✅ Edge deleted successfully from {database}!</h4>
                    </div>

                    <div className="space-y-2 text-sm">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <strong>Relationship:</strong> {result.data?.deletedEdge?.relationshipType}
                            </div>
                            <div>
                                <strong>Target Database:</strong>
                                <span className={`ml-2 px-2 py-1 text-xs rounded ${
                                    result.data?.database === 'memgraph'
                                        ? 'bg-blue-100 text-blue-800'
                                        : 'bg-red-100 text-red-800'
                                }`}>
                                    {result.data?.database === 'memgraph' ? '🔵 Memgraph' : '🔴 Oracle'}
                                </span>
                            </div>
                            <div>
                                <strong>Source ID:</strong> {result.data?.deletedEdge?.sourceId}
                            </div>
                            <div>
                                <strong>Target ID:</strong> {result.data?.deletedEdge?.targetId}
                            </div>
                        </div>

                        {result.data?.deletedEdge && (
                            <div className="mt-3 p-3 bg-white border rounded text-xs">
                                <strong>Deleted Edge:</strong>
                                <pre className="mt-1 overflow-x-auto">
                                    {JSON.stringify(result.data.deletedEdge, null, 2)}
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
                        <h4 className="font-medium text-red-900">❌ Operation failed</h4>
                    </div>
                    <p className="text-red-700 text-sm">{error}</p>
                </div>
            )}

            {/* Info Box */}
            <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg text-sm">
                <h5 className="font-medium text-red-900 mb-2">⚠️ Wichtige Hinweise:</h5>
                <ul className="text-red-800 space-y-1">
                    <li>• <strong>Multi-Database View:</strong> Dropdown zeigt Entities aus beiden Datenbanken</li>
                    <li>• <strong>Target Database:</strong> Edge wird nur in der gewählten Ziel-Datenbank gelöscht</li>
                    <li>• <strong>Einzelbeziehung:</strong> Nur die spezifische Beziehung wird gelöscht, nicht die Entities</li>
                    <li>• <strong>Unwiderruflich:</strong> Gelöschte Edges können nicht wiederhergestellt werden</li>
                    <li>• <strong>Oracle:</strong> Löscht aus der entsprechenden Edge Table</li>
                    <li>• <strong>Memgraph:</strong> Nutzt DELETE für gezielte Edge-Entfernung</li>
                </ul>
            </div>
        </div>
    );
};

export default EdgeDeleter;