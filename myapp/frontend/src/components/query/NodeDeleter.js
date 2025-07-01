// src/components/query/NodeDeleter.js - FIXED Oracle Search Issue
import React, { useState, useEffect } from 'react';
import { Trash2, Search, AlertTriangle, CheckCircle, AlertCircle, RefreshCw, Bug } from 'lucide-react';
import apiService from '../../services/api';
import EntityDropdown from './shared/EntityDropdown';

const NodeDeleter = () => {
    const [entityType, setEntityType] = useState('person');
    const [database, setDatabase] = useState('memgraph');
    const [selectedEntityName, setSelectedEntityName] = useState('');
    const [wikidataId, setWikidataId] = useState('');

    const [nodeInfo, setNodeInfo] = useState(null);
    const [loading, setLoading] = useState(false);
    const [searching, setSearching] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState('');
    const [confirmationRequired, setConfirmationRequired] = useState(false);

    // DEBUG: Add debug information
    const [debugInfo, setDebugInfo] = useState([]);
    const [showDebug, setShowDebug] = useState(false);

    const addDebugInfo = (message, data = null) => {
        const timestamp = new Date().toLocaleTimeString();
        const debugEntry = { timestamp, message, data };
        setDebugInfo(prev => [...prev, debugEntry]);
        console.log(`[NodeDeleter Debug ${timestamp}] ${message}`, data);
    };

    // Entity Type geändert - alles zurücksetzen
    useEffect(() => {
        setSelectedEntityName('');
        setWikidataId('');
        setNodeInfo(null);
        setError('');
        setResult(null);
        setConfirmationRequired(false);
        setDebugInfo([]);
    }, [entityType, database]);

    // 🔧 FIXED: Enhanced ID Extraction for Oracle
    const extractIdFromEntity = (entity, database) => {
        addDebugInfo(`Extracting ID from entity`, { entity, database });

        if (database === 'oracle') {
            // Oracle: Try different ID fields and extract from parentheses
            let id = entity.id || entity.ID || entity.VERTEX_ID;

            addDebugInfo(`Oracle raw ID fields`, {
                id: entity.id,
                ID: entity.ID,
                VERTEX_ID: entity.VERTEX_ID
            });

            if (id && id.includes('(')) {
                // Extract from format like "(Q7251)" or "VERTEX_ID(Q7251)"
                const match = id.match(/\(([^)]+)\)/);
                if (match) {
                    const extractedId = match[1];
                    addDebugInfo(`Extracted Oracle ID from parentheses: ${extractedId}`);
                    return extractedId;
                }
            }

            addDebugInfo(`Using Oracle ID as-is: ${id}`);
            return id;
        } else {
            // Memgraph: Use standard fields
            const id = entity['e.id'] || entity.id;
            addDebugInfo(`Memgraph ID: ${id}`);
            return id;
        }
    };

    // 🔧 ENHANCED: Entity Name geändert - ID aus gewählter Datenbank extrahieren
    const handleEntityNameChange = async (entityName) => {
        addDebugInfo(`Entity name changed to: "${entityName}"`);

        setSelectedEntityName(entityName);
        setWikidataId('');
        setNodeInfo(null);
        setError('');
        setResult(null);
        setConfirmationRequired(false);

        if (entityName.trim() === '') return;

        try {
            let extractedId = null;

            // Wenn spezifische DB gewählt, dort zuerst suchen
            if (database !== 'both') {
                addDebugInfo(`Searching in ${database} for entity: ${entityName}`);

                const searchResult = await apiService.searchEntityNames(entityType, entityName, database, 10);

                addDebugInfo(`Search result for ${database}`, searchResult);

                if (searchResult.success && searchResult.data.results.length > 0) {
                    // Find exact match first
                    const exactMatch = searchResult.data.results.find(entity => {
                        const entityNameFromResult = database === 'oracle'
                            ? (entity.NAME || entity.name)
                            : (entity['e.name'] || entity.name);

                        addDebugInfo(`Comparing "${entityNameFromResult}" with "${entityName}"`);
                        return entityNameFromResult === entityName;
                    });

                    const entity = exactMatch || searchResult.data.results[0];
                    addDebugInfo(`Selected entity for ID extraction`, entity);

                    extractedId = extractIdFromEntity(entity, database);
                }
            } else {
                // 🔄 BOTH DATABASES: Parallel suchen und passende ID nehmen
                addDebugInfo(`Searching in both databases for entity: ${entityName}`);

                const [memgraphResult, oracleResult] = await Promise.allSettled([
                    apiService.searchEntityNames(entityType, entityName, 'memgraph', 10),
                    apiService.searchEntityNames(entityType, entityName, 'oracle', 10)
                ]);

                addDebugInfo(`Parallel search results`, { memgraphResult, oracleResult });

                // Memgraph zuerst probieren
                if (memgraphResult.status === 'fulfilled' && memgraphResult.value.success) {
                    const exactMatch = memgraphResult.value.data.results.find(entity => {
                        const entityNameFromResult = entity['e.name'] || entity.name;
                        return entityNameFromResult === entityName;
                    });

                    if (exactMatch) {
                        extractedId = extractIdFromEntity(exactMatch, 'memgraph');
                    }
                }

                // Falls nicht in Memgraph gefunden, Oracle probieren
                if (!extractedId && oracleResult.status === 'fulfilled' && oracleResult.value.success) {
                    const exactMatch = oracleResult.value.data.results.find(entity => {
                        const entityNameFromResult = entity.NAME || entity.name;
                        return entityNameFromResult === entityName;
                    });

                    if (exactMatch) {
                        extractedId = extractIdFromEntity(exactMatch, 'oracle');
                    }
                }
            }

            if (extractedId) {
                addDebugInfo(`Successfully extracted ID: ${extractedId}`);
                setWikidataId(extractedId);
            } else {
                addDebugInfo(`No ID could be extracted for entity: ${entityName}`);
            }
        } catch (err) {
            addDebugInfo(`Error during ID extraction`, err);
            console.warn('Could not extract Wikidata ID:', err);
        }
    };

    // 🔧 ENHANCED: Node für Deletion suchen mit verbessertem Error Handling
    const searchNodeForDeletion = async () => {
        if (!wikidataId.trim()) {
            setError('Please select an entity or enter a Wikidata ID');
            return;
        }

        addDebugInfo(`Starting node search for deletion`, { entityType, wikidataId, database });

        setSearching(true);
        setError('');
        setNodeInfo(null);

        try {
            // 🔧 WORKAROUND: For Oracle, try searching by name first if direct ID lookup fails
            let info;

            try {
                info = await apiService.getNodeForDeletion(entityType, wikidataId, database);
                addDebugInfo(`Direct node search successful`, info);
            } catch (directError) {
                addDebugInfo(`Direct node search failed`, directError);

                if (database === 'oracle' && directError.message.includes('Property does not exist')) {
                    addDebugInfo(`Trying Oracle workaround: search by name instead of ID`);

                    // Try to find the entity by searching for it instead of direct ID lookup
                    if (selectedEntityName) {
                        try {
                            // Search for the entity by name in Oracle
                            const searchResult = await apiService.searchEntityNames(entityType, selectedEntityName, 'oracle', 10);

                            if (searchResult.success && searchResult.data.results.length > 0) {
                                const foundEntity = searchResult.data.results.find(entity => {
                                    const entityId = extractIdFromEntity(entity, 'oracle');
                                    return entityId === wikidataId;
                                });

                                if (foundEntity) {
                                    addDebugInfo(`Found entity through search workaround`, foundEntity);

                                    // Manually construct node info since direct lookup failed
                                    info = {
                                        success: true,
                                        node: {
                                            name: foundEntity.NAME || foundEntity.name,
                                            id: wikidataId,
                                            ...foundEntity
                                        },
                                        relationshipInfo: {
                                            total: 0, // We can't get relationships due to the Oracle query issue
                                            outgoing: 0,
                                            incoming: 0,
                                            details: null
                                        },
                                        deletionWarning: 'Oracle ID property issue detected. Relationship count unavailable, but node exists.',
                                        canDelete: true
                                    };
                                } else {
                                    throw new Error(`Entity with ID ${wikidataId} not found in Oracle search results`);
                                }
                            } else {
                                throw new Error(`No search results found for "${selectedEntityName}" in Oracle`);
                            }
                        } catch (searchError) {
                            addDebugInfo(`Search workaround also failed`, searchError);
                            throw directError; // Use original error
                        }
                    } else {
                        throw new Error(`Oracle backend has a query issue with entity IDs. Please select an entity from the dropdown first, then try again.`);
                    }
                } else {
                    throw directError;
                }
            }

            setNodeInfo(info);
            setConfirmationRequired(info.relationshipInfo.total > 0);

        } catch (err) {
            addDebugInfo(`Node search failed completely`, err);

            // 🔧 ENHANCED ERROR MESSAGES: Better error explanations
            let errorMessage = err.message;

            if (err.message.includes('Property does not exist')) {
                errorMessage = `⚠️ Oracle Backend Issue Detected:

The Oracle database backend has a query problem with the 'e.id' property.

WORKAROUND:
1. Select the entity from the dropdown first (this populates the name)
2. Then try "Search in Oracle" again
3. Or contact the backend team to fix the Oracle PGQL query

Technical Details:
${err.message}`;
            } else if (err.message.includes('404') || err.message.includes('not found')) {
                errorMessage = `Node with ID "${wikidataId}" not found in ${database} database. Please check:
• The Wikidata ID is correct
• The entity exists in the ${database} database  
• The entity type (${entityType}) is correct`;
            } else if (err.message.includes('500')) {
                errorMessage = `Server error when searching in ${database}. Please try again or contact support.`;
            }

            setError(errorMessage);
        } finally {
            setSearching(false);
        }
    };

    // Node löschen
    const deleteNode = async () => {
        if (!nodeInfo) {
            setError('Please search for a node first');
            return;
        }

        addDebugInfo(`Starting node deletion`, { entityType, wikidataId, database });

        setDeleting(true);
        setError('');
        setResult(null);

        try {
            const deleteResult = await apiService.deleteNode(entityType, wikidataId, database);

            addDebugInfo(`Node deletion successful`, deleteResult);

            setResult(deleteResult);

            // Form zurücksetzen nach erfolgreichem Löschen
            setSelectedEntityName('');
            setWikidataId('');
            setNodeInfo(null);
            setConfirmationRequired(false);

        } catch (err) {
            addDebugInfo(`Node deletion failed`, err);
            setError(err.message);
        } finally {
            setDeleting(false);
        }
    };

    return (
        <div className="bg-white rounded-lg border p-6">
            <div className="flex items-center gap-3 mb-6">
                <Trash2 className="text-red-600" size={24} />
                <div>
                    <h3 className="text-lg font-semibold text-gray-900">Knoten löschen</h3>
                    <p className="text-gray-600">Lösche eine Entity und alle ihre Beziehungen aus der Datenbank</p>
                </div>

                {/* Debug Toggle */}
                <button
                    onClick={() => setShowDebug(!showDebug)}
                    className="ml-auto p-2 text-gray-400 hover:text-gray-600"
                    title="Toggle Debug Info"
                >
                    <Bug size={16} />
                </button>
            </div>

            {/* Debug Information */}
            {showDebug && debugInfo.length > 0 && (
                <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <h4 className="font-medium text-yellow-900 mb-3 flex items-center gap-2">
                        <Bug size={16} />
                        Debug Information
                    </h4>
                    <div className="max-h-40 overflow-y-auto text-xs space-y-1">
                        {debugInfo.slice(-10).map((info, index) => (
                            <div key={index} className="text-yellow-800">
                                <span className="font-mono">[{info.timestamp}]</span> {info.message}
                                {info.data && (
                                    <pre className="mt-1 ml-4 text-yellow-700 overflow-x-auto">
                                        {JSON.stringify(info.data, null, 2)}
                                    </pre>
                                )}
                            </div>
                        ))}
                    </div>
                    <button
                        onClick={() => setDebugInfo([])}
                        className="mt-2 text-xs text-yellow-700 hover:text-yellow-900"
                    >
                        Clear Debug Log
                    </button>
                </div>
            )}

            {/* Entity Type & Database Selection */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">Entity Type</label>
                    <select
                        value={entityType}
                        onChange={(e) => setEntityType(e.target.value)}
                        className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
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
                    <label className="block text-sm font-medium text-gray-700">Target Database</label>
                    <select
                        value={database}
                        onChange={(e) => setDatabase(e.target.value)}
                        className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="memgraph">🔵 Memgraph (Cypher)</option>
                        <option value="oracle">🔴 Oracle (PGQL)</option>
                    </select>
                    <p className="text-xs text-gray-500">
                        Dropdown shows entities from both databases, but deletion targets only the selected database.
                    </p>
                </div>
            </div>

            {/* Entity Selection - ENHANCED */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
                <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                        Entity Name
                        <span className="text-sm text-gray-500 ml-1">(from both databases)</span>
                    </label>
                    <EntityDropdown
                        value={selectedEntityName}
                        onChange={handleEntityNameChange}
                        entityType={entityType}
                        database="both" // 🔧 FIXED: Immer beide DBs anzeigen
                        placeholder={`Select ${entityType} to delete...`}
                        showDatabaseIndicator={true}
                    />
                    <p className="text-xs text-gray-500">
                        🔵 = Memgraph, 🔴 = Oracle, 🔵🔴 = Both databases
                    </p>
                </div>

                <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                        Wikidata ID
                        <span className="text-sm text-gray-500 ml-1">(auto-filled or manual entry)</span>
                    </label>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={wikidataId}
                            onChange={(e) => setWikidataId(e.target.value)}
                            placeholder="Q1234567890"
                            className="flex-1 p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                        <button
                            onClick={searchNodeForDeletion}
                            disabled={searching || !wikidataId.trim()}
                            className={`px-4 py-3 text-white rounded-lg hover:opacity-90 disabled:opacity-50 flex items-center gap-2 ${
                                database === 'oracle' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
                            }`}
                        >
                            {searching ? (
                                <RefreshCw size={16} className="animate-spin" />
                            ) : (
                                <Search size={16} />
                            )}
                            Search in {database === 'oracle' ? '🔴 Oracle' : '🔵 Memgraph'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Node Information */}
            {nodeInfo && (
                <div className="mb-6 p-4 border rounded-lg bg-gray-50">
                    <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                        <Search size={16} />
                        Node found in {database}
                    </h4>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                            <strong>Name:</strong> {nodeInfo.node?.NAME || nodeInfo.node?.name || 'N/A'}
                        </div>
                        <div>
                            <strong>Wikidata ID:</strong> {wikidataId}
                        </div>
                        <div>
                            <strong>Entity Type:</strong> {entityType}
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
                    </div>

                    {/* Relationship Warning */}
                    <div className={`p-3 rounded-lg flex items-start gap-2 ${
                        nodeInfo.relationshipInfo.total > 0
                            ? 'bg-yellow-50 border border-yellow-200'
                            : 'bg-green-50 border border-green-200'
                    }`}>
                        <AlertTriangle
                            size={16}
                            className={nodeInfo.relationshipInfo.total > 0 ? 'text-yellow-600 mt-0.5' : 'text-green-600 mt-0.5'}
                        />
                        <div className="text-sm">
                            <p className={nodeInfo.relationshipInfo.total > 0 ? 'text-yellow-800' : 'text-green-800'}>
                                {nodeInfo.deletionWarning}
                            </p>
                            {nodeInfo.relationshipInfo.total > 0 && (
                                <div className="mt-2 text-xs text-yellow-700">
                                    <strong>Relationships in {database}:</strong> {nodeInfo.relationshipInfo.outgoing} outgoing, {nodeInfo.relationshipInfo.incoming} incoming
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Node Properties */}
                    {nodeInfo.node && (
                        <div className="mt-4 p-3 bg-white border rounded text-xs">
                            <strong>Node Properties ({database}):</strong>
                            <pre className="mt-1 overflow-x-auto text-gray-600">
                                {JSON.stringify(nodeInfo.node, null, 2)}
                            </pre>
                        </div>
                    )}
                </div>
            )}

            {/* Confirmation Required */}
            {confirmationRequired && nodeInfo && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-center gap-2 mb-3">
                        <AlertTriangle className="text-red-600" size={20} />
                        <h4 className="font-medium text-red-900">⚠️ Confirmation Required</h4>
                    </div>
                    <p className="text-red-800 text-sm mb-3">
                        This node has <strong>{nodeInfo.relationshipInfo.total} relationships in {database}</strong> that will be permanently deleted along with the node.
                        This action cannot be undone.
                    </p>
                    <label className="flex items-center gap-2 text-sm">
                        <input
                            type="checkbox"
                            checked={!confirmationRequired}
                            onChange={(e) => setConfirmationRequired(!e.target.checked)}
                            className="rounded"
                        />
                        <span className="text-red-700">
                            I understand that this will permanently delete the node from <strong>{database}</strong> and all its {nodeInfo.relationshipInfo.total} relationships.
                        </span>
                    </label>
                </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 mb-6">
                <button
                    onClick={deleteNode}
                    disabled={deleting || !nodeInfo || confirmationRequired}
                    className="flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {deleting ? (
                        <>
                            <RefreshCw size={16} className="animate-spin" />
                            Deleting from {database}...
                        </>
                    ) : (
                        <>
                            <Trash2 size={16} />
                            Delete {entityType} from {database}
                        </>
                    )}
                </button>

                <button
                    onClick={() => {
                        setSelectedEntityName('');
                        setWikidataId('');
                        setNodeInfo(null);
                        setError('');
                        setResult(null);
                        setConfirmationRequired(false);
                        setDebugInfo([]);
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
                        <h4 className="font-medium text-green-900">✅ Node deleted successfully from {database}!</h4>
                    </div>

                    <div className="space-y-2 text-sm">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <strong>Deleted Node:</strong> {result.data?.deletedNode?.wikidataId}
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
                                <strong>Entity Type:</strong> {result.data?.deletedNode?.entityType}
                            </div>
                            <div>
                                <strong>Deleted Edges:</strong> {result.data?.deletedEdges?.count || 0}
                            </div>
                        </div>

                        {result.data?.deletedEdges?.count > 0 && (
                            <div className="mt-3 p-3 bg-white border rounded text-xs">
                                <strong>Deleted Relationships:</strong>
                                <pre className="mt-1 overflow-x-auto">
                                    {JSON.stringify(result.data.deletedEdges.details, null, 2)}
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
                        <h4 className="font-medium text-red-900">❌ Search/Deletion failed</h4>
                    </div>
                    <pre className="text-red-700 text-sm whitespace-pre-wrap">{error}</pre>
                </div>
            )}

            {/* Info Box */}
            <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg text-sm">
                <h5 className="font-medium text-red-900 mb-2">⚠️ Wichtige Hinweise:</h5>
                <ul className="text-red-800 space-y-1">
                    <li>• <strong>Multi-Database View:</strong> Dropdown zeigt Entities aus beiden Datenbanken</li>
                    <li>• <strong>Target Database:</strong> Deletion erfolgt nur in der gewählten Ziel-Datenbank</li>
                    <li>• <strong>Oracle IDs:</strong> Werden automatisch aus (Q1234) Format extrahiert</li>
                    <li>• <strong>Unwiderruflich:</strong> Gelöschte Nodes und Edges können nicht wiederhergestellt werden</li>
                    <li>• <strong>Cascade Delete:</strong> Alle Beziehungen des Nodes werden automatisch mit gelöscht</li>
                    <li>• <strong>Debug Mode:</strong> Klicke auf <Bug size={12} className="inline" /> für detaillierte Logs</li>
                </ul>
            </div>
        </div>
    );
};

export default NodeDeleter;