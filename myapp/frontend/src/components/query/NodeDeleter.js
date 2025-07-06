// src/components/query/NodeDeleter.js - DEUTSCHE VERSION mit LabelTranslator
import React, { useState, useEffect } from 'react';
import { Trash2, Search, AlertTriangle, CheckCircle, AlertCircle, RefreshCw, Bug } from 'lucide-react';
import apiService from '../../services/api';
import EntityDropdown from './shared/EntityDropdown';
import {
    getEntityTypeLabel,
    getEntityTypeSimple,
    getDatabaseLabel,
    getPlaceholderText
} from './shared/LabelTranslator';

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
        addDebugInfo(`ID aus Entity extrahieren`, { entity, database });

        if (database === 'oracle') {
            // Oracle: Try different ID fields and extract from parentheses
            let id = entity.id || entity.ID || entity.VERTEX_ID;

            addDebugInfo(`Oracle Raw-ID-Felder`, {
                id: entity.id,
                ID: entity.ID,
                VERTEX_ID: entity.VERTEX_ID
            });

            if (id && id.includes('(')) {
                // Extract from format like "(Q7251)" or "VERTEX_ID(Q7251)"
                const match = id.match(/\(([^)]+)\)/);
                if (match) {
                    const extractedId = match[1];
                    addDebugInfo(`Oracle-ID aus Klammern extrahiert: ${extractedId}`);
                    return extractedId;
                }
            }

            addDebugInfo(`Oracle-ID wie gefunden verwendet: ${id}`);
            return id;
        } else {
            // Memgraph: Use standard fields
            const id = entity['e.id'] || entity.id;
            addDebugInfo(`Memgraph-ID: ${id}`);
            return id;
        }
    };

    // 🔧 ENHANCED: Entity Name geändert - ID aus gewählter Datenbank extrahieren
    const handleEntityNameChange = async (entityName) => {
        addDebugInfo(`Entity-Name geändert zu: "${entityName}"`);

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
                addDebugInfo(`Suche in ${database} nach Entity: ${entityName}`);

                const searchResult = await apiService.searchEntityNames(entityType, entityName, database, 10);

                addDebugInfo(`Suchergebnis für ${database}`, searchResult);

                if (searchResult.success && searchResult.data.results.length > 0) {
                    // Find exact match first
                    const exactMatch = searchResult.data.results.find(entity => {
                        const entityNameFromResult = database === 'oracle'
                            ? (entity.NAME || entity.name)
                            : (entity['e.name'] || entity.name);

                        addDebugInfo(`Vergleiche "${entityNameFromResult}" mit "${entityName}"`);
                        return entityNameFromResult === entityName;
                    });

                    const entity = exactMatch || searchResult.data.results[0];
                    addDebugInfo(`Gewählte Entity für ID-Extraktion`, entity);

                    extractedId = extractIdFromEntity(entity, database);
                }
            } else {
                // 🔄 BEIDE DATENBANKEN: Parallel suchen und passende ID nehmen
                addDebugInfo(`Suche in beiden Datenbanken nach Entity: ${entityName}`);

                const [memgraphResult, oracleResult] = await Promise.allSettled([
                    apiService.searchEntityNames(entityType, entityName, 'memgraph', 10),
                    apiService.searchEntityNames(entityType, entityName, 'oracle', 10)
                ]);

                addDebugInfo(`Parallele Suchergebnisse`, { memgraphResult, oracleResult });

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
                addDebugInfo(`ID erfolgreich extrahiert: ${extractedId}`);
                setWikidataId(extractedId);
            } else {
                addDebugInfo(`Keine ID konnte für Entity extrahiert werden: ${entityName}`);
            }
        } catch (err) {
            addDebugInfo(`Fehler bei ID-Extraktion`, err);
            console.warn('Konnte Wikidata-ID nicht extrahieren:', err);
        }
    };

    // 🔧 ENHANCED: Node für Deletion suchen mit verbessertem Error Handling
    const searchNodeForDeletion = async () => {
        if (!wikidataId.trim()) {
            setError('Bitte wählen Sie eine Entity aus oder geben Sie eine Wikidata-ID ein');
            return;
        }

        addDebugInfo(`Starte Node-Suche für Löschung`, { entityType, wikidataId, database });

        setSearching(true);
        setError('');
        setNodeInfo(null);

        try {
            // 🔧 WORKAROUND: Für Oracle, versuche zuerst Suche nach Name wenn direkte ID-Suche fehlschlägt
            let info;

            try {
                info = await apiService.getNodeForDeletion(entityType, wikidataId, database);
                addDebugInfo(`Direkte Node-Suche erfolgreich`, info);
            } catch (directError) {
                addDebugInfo(`Direkte Node-Suche fehlgeschlagen`, directError);

                if (database === 'oracle' && directError.message.includes('Property does not exist')) {
                    addDebugInfo(`Versuche Oracle-Workaround: Suche nach Name statt ID`);

                    // Versuche die Entity durch Suche zu finden statt direkter ID-Suche
                    if (selectedEntityName) {
                        try {
                            // Suche nach der Entity mit Namen in Oracle
                            const searchResult = await apiService.searchEntityNames(entityType, selectedEntityName, 'oracle', 10);

                            if (searchResult.success && searchResult.data.results.length > 0) {
                                const foundEntity = searchResult.data.results.find(entity => {
                                    const entityId = extractIdFromEntity(entity, 'oracle');
                                    return entityId === wikidataId;
                                });

                                if (foundEntity) {
                                    addDebugInfo(`Entity durch Such-Workaround gefunden`, foundEntity);

                                    // Manuell Node-Info erstellen da direkte Suche fehlschlug
                                    info = {
                                        success: true,
                                        node: {
                                            name: foundEntity.NAME || foundEntity.name,
                                            id: wikidataId,
                                            ...foundEntity
                                        },
                                        relationshipInfo: {
                                            total: 0, // Wir können keine Beziehungen abrufen aufgrund des Oracle-Query-Problems
                                            outgoing: 0,
                                            incoming: 0,
                                            details: null
                                        },
                                        deletionWarning: 'Oracle-ID-Property-Problem erkannt. Beziehungsanzahl nicht verfügbar, aber Node existiert.',
                                        canDelete: true
                                    };
                                } else {
                                    throw new Error(`Entity mit ID ${wikidataId} nicht in Oracle-Suchergebnissen gefunden`);
                                }
                            } else {
                                throw new Error(`Keine Suchergebnisse für "${selectedEntityName}" in Oracle gefunden`);
                            }
                        } catch (searchError) {
                            addDebugInfo(`Such-Workaround auch fehlgeschlagen`, searchError);
                            throw directError; // Ursprünglichen Fehler verwenden
                        }
                    } else {
                        throw new Error(`Oracle-Backend hat ein Query-Problem mit Entity-IDs. Bitte wählen Sie zuerst eine Entity aus dem Dropdown aus und versuchen Sie es dann erneut.`);
                    }
                } else {
                    throw directError;
                }
            }

            setNodeInfo(info);
            setConfirmationRequired(info.relationshipInfo.total > 0);

        } catch (err) {
            addDebugInfo(`Node-Suche vollständig fehlgeschlagen`, err);

            // 🔧 ENHANCED ERROR MESSAGES: Bessere Fehlererklärungen
            let errorMessage = err.message;

            if (err.message.includes('Property does not exist')) {
                errorMessage = `⚠️ Oracle-Backend-Problem erkannt:

Das Oracle-Datenbank-Backend hat ein Query-Problem mit der 'e.id' Property.

WORKAROUND:
1. Wählen Sie die Entity zuerst aus dem Dropdown aus (das füllt den Namen)
2. Versuchen Sie dann "In Oracle suchen" erneut
3. Oder kontaktieren Sie das Backend-Team um die Oracle-PGQL-Query zu reparieren

Technische Details:
${err.message}`;
            } else if (err.message.includes('404') || err.message.includes('not found')) {
                errorMessage = `Node mit ID "${wikidataId}" in ${database}-Datenbank nicht gefunden. Bitte prüfen Sie:
• Die Wikidata-ID ist korrekt
• Die Entity existiert in der ${database}-Datenbank  
• Der Entity-Typ (${entityType}) ist korrekt`;
            } else if (err.message.includes('500')) {
                errorMessage = `Server-Fehler bei der Suche in ${database}. Bitte versuchen Sie es erneut oder kontaktieren Sie den Support.`;
            }

            setError(errorMessage);
        } finally {
            setSearching(false);
        }
    };

    // Node löschen
    const deleteNode = async () => {
        if (!nodeInfo) {
            setError('Bitte suchen Sie zuerst nach einem Node');
            return;
        }

        addDebugInfo(`Starte Node-Löschung`, { entityType, wikidataId, database });

        setDeleting(true);
        setError('');
        setResult(null);

        try {
            const deleteResult = await apiService.deleteNode(entityType, wikidataId, database);

            addDebugInfo(`Node-Löschung erfolgreich`, deleteResult);

            setResult(deleteResult);

            // Form zurücksetzen nach erfolgreichem Löschen
            setSelectedEntityName('');
            setWikidataId('');
            setNodeInfo(null);
            setConfirmationRequired(false);

        } catch (err) {
            addDebugInfo(`Node-Löschung fehlgeschlagen`, err);
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
                    title="Debug-Info umschalten"
                >
                    <Bug size={16} />
                </button>
            </div>

            {/* Debug Information */}
            {showDebug && debugInfo.length > 0 && (
                <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <h4 className="font-medium text-yellow-900 mb-3 flex items-center gap-2">
                        <Bug size={16} />
                        Debug-Informationen
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
                        Debug-Log leeren
                    </button>
                </div>
            )}

            {/* Entity Type & Database Selection */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">Entity-Typ</label>
                    <select
                        value={entityType}
                        onChange={(e) => setEntityType(e.target.value)}
                        className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="person">{getEntityTypeLabel('person')}</option>
                        <option value="place">{getEntityTypeLabel('place')}</option>
                        <option value="work">{getEntityTypeLabel('work')}</option>
                        <option value="award">{getEntityTypeLabel('award')}</option>
                        <option value="field">{getEntityTypeLabel('field')}</option>
                        <option value="occupation">{getEntityTypeLabel('occupation')}</option>
                        <option value="workplace">{getEntityTypeLabel('workplace')}</option>
                    </select>
                </div>

                <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">Ziel-Datenbank</label>
                    <select
                        value={database}
                        onChange={(e) => setDatabase(e.target.value)}
                        className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="memgraph">🔵 Memgraph (Cypher)</option>
                        <option value="oracle">🔴 Oracle (PGQL)</option>
                    </select>
                    <p className="text-xs text-gray-500">
                        Dropdown zeigt Entities aus beiden Datenbanken, aber Löschung erfolgt nur in der gewählten Datenbank.
                    </p>
                </div>
            </div>

            {/* Entity Selection */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
                <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                        Entity-Name
                        <span className="text-sm text-gray-500 ml-1">(aus beiden Datenbanken)</span>
                    </label>
                    <EntityDropdown
                        value={selectedEntityName}
                        onChange={handleEntityNameChange}
                        entityType={entityType}
                        database="both"
                        placeholder={getPlaceholderText(entityType, 'zum Löschen auswählen')}
                        showDatabaseIndicator={true}
                    />
                    <p className="text-xs text-gray-500">
                        🔵 = Memgraph, 🔴 = Oracle, 🔵🔴 = Beide Datenbanken
                    </p>
                </div>

                <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                        Wikidata-ID
                        <span className="text-sm text-gray-500 ml-1">(automatisch ausgefüllt oder manuelle Eingabe)</span>
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
                            In {getDatabaseLabel(database)} suchen
                        </button>
                    </div>
                </div>
            </div>

            {/* Node Information */}
            {nodeInfo && (
                <div className="mb-6 p-4 border rounded-lg bg-gray-50">
                    <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                        <Search size={16} />
                        Node in {database} gefunden
                    </h4>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                            <strong>Name:</strong> {nodeInfo.node?.NAME || nodeInfo.node?.name || 'N/A'}
                        </div>
                        <div>
                            <strong>Wikidata-ID:</strong> {wikidataId}
                        </div>
                        <div>
                            <strong>Entity-Typ:</strong> {getEntityTypeSimple(entityType)}
                        </div>
                        <div>
                            <strong>Ziel-Datenbank:</strong>
                            <span className={`ml-2 px-2 py-1 text-xs rounded ${
                                database === 'memgraph'
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-red-100 text-red-800'
                            }`}>
                                {getDatabaseLabel(database)}
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
                                    <strong>Beziehungen in {database}:</strong> {nodeInfo.relationshipInfo.outgoing} ausgehend, {nodeInfo.relationshipInfo.incoming} eingehend
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Node Properties */}
                    {nodeInfo.node && (
                        <div className="mt-4 p-3 bg-white border rounded text-xs">
                            <strong>Node-Eigenschaften ({database}):</strong>
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
                        <h4 className="font-medium text-red-900">⚠️ Bestätigung erforderlich</h4>
                    </div>
                    <p className="text-red-800 text-sm mb-3">
                        Dieser Node hat <strong>{nodeInfo.relationshipInfo.total} Beziehungen in {database}</strong>, die zusammen mit dem Node dauerhaft gelöscht werden.
                        Diese Aktion kann nicht rückgängig gemacht werden.
                    </p>
                    <label className="flex items-center gap-2 text-sm">
                        <input
                            type="checkbox"
                            checked={!confirmationRequired}
                            onChange={(e) => setConfirmationRequired(!e.target.checked)}
                            className="rounded"
                        />
                        <span className="text-red-700">
                            Ich verstehe, dass dies den Node aus <strong>{database}</strong> und alle seine {nodeInfo.relationshipInfo.total} Beziehungen dauerhaft löscht.
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
                            Lösche aus {database}...
                        </>
                    ) : (
                        <>
                            <Trash2 size={16} />
                            {getEntityTypeSimple(entityType)} aus {getDatabaseLabel(database)} löschen
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
                    Formular zurücksetzen
                </button>
            </div>

            {/* Success Result */}
            {result && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center gap-2 mb-3">
                        <CheckCircle className="text-green-600" size={20} />
                        <h4 className="font-medium text-green-900">✅ Node erfolgreich aus {database} gelöscht!</h4>
                    </div>

                    <div className="space-y-2 text-sm">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <strong>Gelöschter Node:</strong> {result.data?.deletedNode?.wikidataId}
                            </div>
                            <div>
                                <strong>Ziel-Datenbank:</strong>
                                <span className={`ml-2 px-2 py-1 text-xs rounded ${
                                    result.data?.database === 'memgraph'
                                        ? 'bg-blue-100 text-blue-800'
                                        : 'bg-red-100 text-red-800'
                                }`}>
                                    {getDatabaseLabel(result.data?.database)}
                                </span>
                            </div>
                            <div>
                                <strong>Entity-Typ:</strong> {getEntityTypeSimple(result.data?.deletedNode?.entityType)}
                            </div>
                            <div>
                                <strong>Gelöschte Edges:</strong> {result.data?.deletedEdges?.count || 0}
                            </div>
                        </div>

                        {result.data?.deletedEdges?.count > 0 && (
                            <div className="mt-3 p-3 bg-white border rounded text-xs">
                                <strong>Gelöschte Beziehungen:</strong>
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
                        <h4 className="font-medium text-red-900">❌ Suche/Löschung fehlgeschlagen</h4>
                    </div>
                    <pre className="text-red-700 text-sm whitespace-pre-wrap">{error}</pre>
                </div>
            )}

            {/* Info Box */}
            <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg text-sm">
                <h5 className="font-medium text-red-900 mb-2">⚠️ Wichtige Hinweise:</h5>
                <ul className="text-red-800 space-y-1">
                    <li>• <strong>Multi-Datenbank-Ansicht:</strong> Dropdown zeigt Entities aus beiden Datenbanken</li>
                    <li>• <strong>Ziel-Datenbank:</strong> Löschung erfolgt nur in der gewählten Ziel-Datenbank</li>
                    <li>• <strong>Oracle-IDs:</strong> Werden automatisch aus (Q1234) Format extrahiert</li>
                    <li>• <strong>Unwiderruflich:</strong> Gelöschte Nodes und Edges können nicht wiederhergestellt werden</li>
                    <li>• <strong>Kaskadenlöschung:</strong> Alle Beziehungen des Nodes werden automatisch mit gelöscht</li>
                    <li>• <strong>Debug-Modus:</strong> Klicke auf <Bug size={12} className="inline" /> für detaillierte Logs</li>
                </ul>
            </div>
        </div>
    );
};

export default NodeDeleter;