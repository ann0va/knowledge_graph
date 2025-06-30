// src/components/query/NodeDeleter.js - ENHANCED for multi-database support
import React, { useState, useEffect } from 'react';
import { Trash2, Search, AlertTriangle, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
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

    // Entity Type geändert - alles zurücksetzen
    useEffect(() => {
        setSelectedEntityName('');
        setWikidataId('');
        setNodeInfo(null);
        setError('');
        setResult(null);
        setConfirmationRequired(false);
    }, [entityType, database]);

    // 🔧 ENHANCED: Entity Name geändert - ID aus gewählter Datenbank extrahieren
    const handleEntityNameChange = async (entityName) => {
        setSelectedEntityName(entityName);
        setWikidataId('');
        setNodeInfo(null);
        setError('');
        setResult(null);
        setConfirmationRequired(false);

        if (entityName.trim() === '') return;

        try {
            // 🎯 SMART ID EXTRACTION: Versuche aus der gewählten Datenbank zu extrahieren
            let extractedId = null;

            // Wenn spezifische DB gewählt, dort zuerst suchen
            if (database !== 'both') {
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
            } else {
                // 🔄 BOTH DATABASES: Parallel suchen und passende ID nehmen
                const [memgraphResult, oracleResult] = await Promise.allSettled([
                    apiService.searchEntityNames(entityType, entityName, 'memgraph', 10),
                    apiService.searchEntityNames(entityType, entityName, 'oracle', 10)
                ]);

                // Memgraph zuerst probieren
                if (memgraphResult.status === 'fulfilled' && memgraphResult.value.success) {
                    const exactMatch = memgraphResult.value.data.results.find(entity => {
                        const entityNameFromResult = entity['e.name'] || entity.name;
                        return entityNameFromResult === entityName;
                    });

                    if (exactMatch) {
                        extractedId = exactMatch['e.id'] || exactMatch.id;
                    }
                }

                // Falls nicht in Memgraph gefunden, Oracle probieren
                if (!extractedId && oracleResult.status === 'fulfilled' && oracleResult.value.success) {
                    const exactMatch = oracleResult.value.data.results.find(entity => {
                        const entityNameFromResult = entity.NAME || entity.name;
                        return entityNameFromResult === entityName;
                    });

                    if (exactMatch) {
                        extractedId = exactMatch.id || exactMatch.ID;
                    }
                }
            }

            if (extractedId) {
                setWikidataId(extractedId);
            }
        } catch (err) {
            console.warn('Could not extract Wikidata ID:', err);
        }
    };

    // Node für Deletion suchen
    const searchNodeForDeletion = async () => {
        if (!wikidataId.trim()) {
            setError('Please select an entity or enter a Wikidata ID');
            return;
        }

        setSearching(true);
        setError('');
        setNodeInfo(null);

        try {
            const info = await apiService.getNodeForDeletion(entityType, wikidataId, database);
            setNodeInfo(info);
            setConfirmationRequired(info.relationshipInfo.total > 0);
        } catch (err) {
            setError(err.message);
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

        setDeleting(true);
        setError('');
        setResult(null);

        try {
            const deleteResult = await apiService.deleteNode(entityType, wikidataId, database);
            setResult(deleteResult);

            // Form zurücksetzen nach erfolgreichem Löschen
            setSelectedEntityName('');
            setWikidataId('');
            setNodeInfo(null);
            setConfirmationRequired(false);

        } catch (err) {
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
            </div>

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
                            className="px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                        >
                            {searching ? (
                                <RefreshCw size={16} className="animate-spin" />
                            ) : (
                                <Search size={16} />
                            )}
                            Search in {database}
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
                            <strong>Name:</strong> {nodeInfo.node?.name || 'N/A'}
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
                        <h4 className="font-medium text-red-900">❌ Deletion failed</h4>
                    </div>
                    <p className="text-red-700 text-sm">{error}</p>
                </div>
            )}

            {/* Info Box */}
            <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg text-sm">
                <h5 className="font-medium text-red-900 mb-2">⚠️ Wichtige Hinweise:</h5>
                <ul className="text-red-800 space-y-1">
                    <li>• <strong>Multi-Database View:</strong> Dropdown zeigt Entities aus beiden Datenbanken</li>
                    <li>• <strong>Target Database:</strong> Deletion erfolgt nur in der gewählten Ziel-Datenbank</li>
                    <li>• <strong>Unwiderruflich:</strong> Gelöschte Nodes und Edges können nicht wiederhergestellt werden</li>
                    <li>• <strong>Cascade Delete:</strong> Alle Beziehungen des Nodes werden automatisch mit gelöscht</li>
                    <li>• <strong>Oracle:</strong> Löscht aus Base Tables und Edge Tables</li>
                    <li>• <strong>Memgraph:</strong> Nutzt DETACH DELETE für komplette Entfernung</li>
                </ul>
            </div>
        </div>
    );
};

export default NodeDeleter;