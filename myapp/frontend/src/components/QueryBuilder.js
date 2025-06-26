// src/components/QueryBuilder.js - FIXED: Korrekte Relationship Types + Result Mapping
import React, { useState } from 'react';
import { Search, Play, Database, GitBranch, User, Award, MapPin, Briefcase, FileText, Building } from 'lucide-react';
import DataViewer from './DataViewer';
import apiService from '../services/api';

const QueryBuilder = () => {
    const [queryType, setQueryType] = useState('find_related');
    const [selectedEntity, setSelectedEntity] = useState('');
    const [selectedEntityType, setSelectedEntityType] = useState('person');
    const [relationshipType, setRelationshipType] = useState('');

    // Autocomplete State
    const [entitySuggestions, setEntitySuggestions] = useState([]);
    const [loadingSuggestions, setLoadingSuggestions] = useState(false);
    const [showSuggestions, setShowSuggestions] = useState(false);

    // Query Results State
    const [queryResults, setQueryResults] = useState(null);
    const [queryLoading, setQueryLoading] = useState(false);
    const [queryError, setQueryError] = useState(null);

    // Mock Daten für Autocomplete (Fallback falls Backend nicht verfügbar)
    const entities = {
        person: ['Alan Turing', 'Beatrice Helen Worsley', 'Alonzo Church', 'Christopher Morcom'],
        award: ['Turing Award', 'Nobel Prize', 'IEEE Medal'],
        field: ['Computer Science', 'Mathematics', 'Cryptography'],
        place: ['London', 'Cambridge', 'Manchester']
    };

    // 🔧 FIXED: Korrekte Relationship Types basierend auf Backend-Daten
    const relationships = {
        person: [
            { id: 'WORKS_IN', label: 'arbeitet in Bereich', target: 'field' },
            { id: 'HAS_OCCUPATION', label: 'hat Beruf', target: 'occupation' },
            { id: 'RECEIVED', label: 'erhielt Auszeichnung', target: 'award' },
            { id: 'BORN_IN', label: 'wurde geboren in', target: 'place' },
            { id: 'DIED_IN', label: 'starb in', target: 'place' },
            { id: 'WORKED_AT', label: 'arbeitete bei', target: 'workplace' },
            { id: 'CREATED', label: 'erschuf Werk', target: 'work' },
            { id: 'STUDENT_OF', label: 'war Student von', target: 'person' },
            { id: 'ADVISED', label: 'betreute', target: 'person' },
            { id: 'PARTNER_OF', label: 'war Partner von', target: 'person' },
            { id: 'RELATIVE_OF', label: 'ist verwandt mit', target: 'person' },
            { id: 'INFLUENCED_BY', label: 'wurde beeinflusst von', target: 'person' },
            { id: 'SIGNIFICANT_FOR', label: 'war bedeutsam für', target: 'person' },
            { id: 'PARENT_OF', label: 'ist Elternteil von', target: 'person' },
            { id: 'NATIONAL_OF', label: 'ist Staatsangehöriger von', target: 'place' }
        ],
        award: [
            { id: 'AWARDED_TO', label: 'wurde verliehen an', target: 'person' },
            { id: 'IN_FIELD', label: 'ist im Bereich', target: 'field' }
        ],
        field: [
            { id: 'WORKED_BY', label: 'wird bearbeitet von', target: 'person' }
        ],
        place: [
            { id: 'BIRTH_PLACE_OF', label: 'ist Geburtsort von', target: 'person' },
            { id: 'DEATH_PLACE_OF', label: 'ist Sterbeort von', target: 'person' },
            { id: 'WORKPLACE_IN', label: 'hat Arbeitsplätze', target: 'workplace' }
        ],
        work: [
            { id: 'CREATED_BY', label: 'wurde erschaffen von', target: 'person' }
        ],
        workplace: [
            { id: 'EMPLOYED', label: 'beschäftigte', target: 'person' }
        ],
        occupation: [
            { id: 'HELD_BY', label: 'wird ausgeübt von', target: 'person' }
        ]
    };

    const queryTypes = [
        { id: 'find_related', label: '🔍 Verwandte Entitäten finden', desc: 'Finde Entitäten, die mit einer bestimmten Entität verbunden sind' },
        { id: 'find_path', label: '🛤️ Pfad finden', desc: 'Finde einen Pfad zwischen zwei Entitäten' },
        { id: 'count_relations', label: '📊 Beziehungen zählen', desc: 'Zähle die Beziehungen einer Entität' },
        { id: 'browse_data', label: '📋 Datenbank durchsuchen', desc: 'Zeige alle verfügbaren Daten in beiden Datenbanken an' }
    ];

    const entityTypes = [
        { id: 'person', label: 'Person', icon: User },
        { id: 'award', label: 'Auszeichnung', icon: Award },
        { id: 'field', label: 'Fachbereich', icon: Database },
        { id: 'place', label: 'Ort', icon: MapPin },
        { id: 'work', label: 'Werk', icon: FileText },
        { id: 'workplace', label: 'Arbeitsplatz', icon: Building },
        { id: 'occupation', label: 'Beruf', icon: Briefcase }
    ];

    // 🎯 AUTOCOMPLETE HANDLER
    const handleEntitySearch = async (searchTerm) => {
        setSelectedEntity(searchTerm);

        if (searchTerm.length < 2) {
            setEntitySuggestions([]);
            setShowSuggestions(false);
            return;
        }

        setLoadingSuggestions(true);
        setShowSuggestions(true);

        try {
            // Backend Autocomplete versuchen
            const result = await apiService.searchEntityNames(selectedEntityType, searchTerm);
            if (result.success && result.data.suggestions) {
                setEntitySuggestions(result.data.suggestions);
            } else {
                // Fallback auf Mock-Daten
                const mockSuggestions = entities[selectedEntityType]?.filter(entity =>
                    entity.toLowerCase().includes(searchTerm.toLowerCase())
                ) || [];
                setEntitySuggestions(mockSuggestions);
            }
        } catch (error) {
            console.error('Autocomplete error:', error);
            // Fallback auf Mock-Daten
            const mockSuggestions = entities[selectedEntityType]?.filter(entity =>
                entity.toLowerCase().includes(searchTerm.toLowerCase())
            ) || [];
            setEntitySuggestions(mockSuggestions);
        } finally {
            setLoadingSuggestions(false);
        }
    };

    // 🎯 QUERY AUSFÜHRUNG
    const executeQuery = async () => {
        if (!selectedEntity || !relationshipType) {
            alert('Bitte alle Felder ausfüllen!');
            return;
        }

        setQueryLoading(true);
        setQueryError(null);
        setQueryResults(null);

        try {
            const queryData = {
                queryType,
                entityType: selectedEntityType,
                entityName: selectedEntity,
                relationshipType,
                targetEntityType: relationships[selectedEntityType]?.find(r => r.id === relationshipType)?.target,
                database: 'both' // Beide DBs abfragen
            };

            console.log('🚀 Executing query:', queryData);

            const result = await apiService.executeStructuredQuery(queryData);

            if (result.success) {
                setQueryResults(result);
                console.log('✅ Query results:', result);
            } else {
                setQueryError(result.error || 'Query execution failed');
            }
        } catch (error) {
            console.error('❌ Query execution error:', error);
            setQueryError(error.message);
        } finally {
            setQueryLoading(false);
        }
    };

    // Query Generierung für Preview
    const generatePseudoQuery = () => {
        if (queryType === 'find_related' && selectedEntity && relationshipType) {
            const rel = relationships[selectedEntityType]?.find(r => r.id === relationshipType);
            return `Finde alle ${rel?.target === 'field' ? 'Fachbereiche' :
                rel?.target === 'award' ? 'Auszeichnungen' :
                    rel?.target === 'place' ? 'Orte' :
                        rel?.target === 'work' ? 'Werke' :
                            rel?.target === 'workplace' ? 'Arbeitsplätze' :
                                rel?.target === 'person' ? 'Personen' :
                                    rel?.target === 'occupation' ? 'Berufe' : 'Entitäten'} die mit ${selectedEntity} durch "${rel?.label}" verbunden sind`;
        }
        return '';
    };

    const generatePGQL = () => {
        if (queryType === 'find_related' && selectedEntity && relationshipType) {
            const rel = relationships[selectedEntityType]?.find(r => r.id === relationshipType);
            return `SELECT t.name, t.id
                    FROM MATCH (p:${selectedEntityType.toUpperCase()})-[:${relationshipType}]->(t:${rel?.target?.toUpperCase() || 'ENTITY'}) ON ALL_GRAPH
                    WHERE p.name = '${selectedEntity}'`;
        }
        return '';
    };

    const generateCypher = () => {
        if (queryType === 'find_related' && selectedEntity && relationshipType) {
            const rel = relationships[selectedEntityType]?.find(r => r.id === relationshipType);
            return `MATCH (p:${selectedEntityType})-[:${relationshipType}]->(t:${rel?.target || 'entity'})
WHERE p.name = '${selectedEntity}'
RETURN t.name, t.id`;
        }
        return '';
    };

    // 🎯 AUTOCOMPLETE INPUT COMPONENT
    const AutocompleteInput = () => (
        <div className="relative">
            <input
                type="text"
                value={selectedEntity}
                onChange={(e) => handleEntitySearch(e.target.value)}
                onFocus={() => selectedEntity.length >= 2 && setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                placeholder={`${selectedEntityType} auswählen...`}
                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            <Search className="absolute right-3 top-3 text-gray-400" size={20} />

            {loadingSuggestions && (
                <div className="absolute right-10 top-3">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent"></div>
                </div>
            )}

            {/* Autocomplete Dropdown */}
            {showSuggestions && entitySuggestions.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-40 overflow-y-auto">
                    {entitySuggestions.map((suggestion, idx) => (
                        <div
                            key={idx}
                            onClick={() => {
                                setSelectedEntity(suggestion);
                                setShowSuggestions(false);
                            }}
                            className="p-2 hover:bg-gray-100 cursor-pointer text-sm"
                        >
                            {suggestion}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );

    // 🔧 FIXED: Query Results Component mit korrektem Mapping
    const QueryResultsDisplay = () => {
        if (queryError) {
            return (
                <div className="mt-6 bg-white rounded-lg border p-6">
                    <h3 className="text-lg font-semibold mb-4 text-red-600">❌ Query Fehler</h3>
                    <div className="p-4 bg-red-50 border border-red-200 rounded text-red-700">
                        {queryError}
                    </div>
                </div>
            );
        }

        if (!queryResults) return null;

        return (
            <div className="mt-6 bg-white rounded-lg border p-6">
                <h3 className="text-lg font-semibold mb-4">🎯 Query-Ergebnisse</h3>

                {/* Oracle Results */}
                {queryResults.results?.oracle && (
                    <div className="mb-6">
                        <h4 className="font-medium text-red-700 mb-3 flex items-center">
                            <Database size={16} className="mr-1" />
                            Oracle Ergebnisse ({queryResults.results.oracle.count || 0})
                        </h4>

                        {queryResults.results.oracle.error ? (
                            <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                                ❌ {queryResults.results.oracle.error}
                            </div>
                        ) : queryResults.results.oracle.relationships && queryResults.results.oracle.relationships.length > 0 ? (
                            <div className="space-y-2">
                                {queryResults.results.oracle.relationships.map((rel, idx) => (
                                    <div key={idx} className="p-3 bg-red-50 rounded border border-red-200 text-sm">
                                        <div className="font-medium">{rel.target_name || rel.TARGET_NAME || 'Unbekannt'}</div>
                                        <div className="text-gray-600">ID: {rel.target_entity_id || rel.TARGET_VERTEX_ID || 'N/A'}</div>
                                        <div className="text-xs text-gray-500">
                                            Typ: {rel.relationship_type || rel.RELATIONSHIP_TYPE || 'N/A'}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="p-3 bg-gray-50 border border-gray-200 rounded text-gray-600 text-sm">
                                ℹ️ Keine Ergebnisse gefunden
                            </div>
                        )}

                        {/* Source Entity Info */}
                        {queryResults.results.oracle.sourceEntity && (
                            <div className="mt-3 p-3 bg-red-25 border border-red-100 rounded text-xs">
                                <strong>Quell-Entity:</strong> {queryResults.results.oracle.sourceEntity.NAME || queryResults.results.oracle.sourceEntity.name || 'N/A'}
                                <br />
                                <strong>ID:</strong> {queryResults.results.oracle.sourceEntity.VERTEX_ID || queryResults.results.oracle.sourceEntity.vertex_id || 'N/A'}
                            </div>
                        )}
                    </div>
                )}

                {/* Memgraph Results */}
                {queryResults.results?.memgraph && (
                    <div className="mb-6">
                        <h4 className="font-medium text-blue-700 mb-3 flex items-center">
                            <Database size={16} className="mr-1" />
                            Memgraph Ergebnisse ({queryResults.results.memgraph.count || 0})
                        </h4>

                        {queryResults.results.memgraph.error ? (
                            <div className="p-3 bg-blue-50 border border-blue-200 rounded text-blue-700 text-sm">
                                ❌ {queryResults.results.memgraph.error}
                            </div>
                        ) : queryResults.results.memgraph.relationships && queryResults.results.memgraph.relationships.length > 0 ? (
                            <div className="space-y-2">
                                {queryResults.results.memgraph.relationships.map((rel, idx) => (
                                    <div key={idx} className="p-3 bg-blue-50 rounded border border-blue-200 text-sm">
                                        <div className="font-medium">{rel.target_name || 'Unbekannt'}</div>
                                        <div className="text-gray-600">ID: {rel.target_entity_id || 'N/A'}</div>
                                        <div className="text-xs text-gray-500">
                                            Labels: {rel.target_labels?.join(', ') || 'N/A'}
                                        </div>
                                        <div className="text-xs text-gray-500">
                                            Typ: {rel.relationship_type || 'N/A'}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="p-3 bg-gray-50 border border-gray-200 rounded text-gray-600 text-sm">
                                ℹ️ Keine Ergebnisse gefunden
                            </div>
                        )}

                        {/* Source Entity Info */}
                        {queryResults.results.memgraph.sourceEntity && (
                            <div className="mt-3 p-3 bg-blue-25 border border-blue-100 rounded text-xs">
                                <strong>Quell-Entity:</strong> {queryResults.results.memgraph.sourceEntity.name || queryResults.results.memgraph.sourceEntity['e.name'] || 'N/A'}
                                <br />
                                <strong>ID:</strong> {queryResults.results.memgraph.sourceEntity.vertex_id || queryResults.results.memgraph.sourceEntity['e.id'] || 'N/A'}
                                <br />
                                <strong>Labels:</strong> {queryResults.results.memgraph.sourceEntity.labels?.join(', ') || 'N/A'}
                            </div>
                        )}
                    </div>
                )}

                {/* Generated Queries */}
                {queryResults.generatedQueries && (
                    <div className="mt-6">
                        <h4 className="font-medium mb-3">🔧 Generierte Queries</h4>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            <div>
                                <h5 className="text-sm font-medium text-red-700 mb-2">Oracle PGQL:</h5>
                                <pre className="bg-red-50 p-3 rounded text-xs overflow-x-auto border border-red-200">
                                    <code>{queryResults.generatedQueries.oracle}</code>
                                </pre>
                            </div>
                            <div>
                                <h5 className="text-sm font-medium text-blue-700 mb-2">Memgraph Cypher:</h5>
                                <pre className="bg-blue-50 p-3 rounded text-xs overflow-x-auto border border-blue-200">
                                    <code>{queryResults.generatedQueries.memgraph}</code>
                                </pre>
                            </div>
                        </div>
                    </div>
                )}

                {/* Metadata */}
                {queryResults.metadata && (
                    <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded text-xs">
                        <strong>Query Metadata:</strong>
                        <br />
                        Ausgeführt auf: {queryResults.metadata.executedOn}
                        <br />
                        Zeitstempel: {new Date(queryResults.metadata.timestamp).toLocaleString()}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="text-center">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">🔍 Query Builder</h2>
                <p className="text-gray-600">Strukturierte Abfrage-Erstellung für Oracle PGQL und Memgraph Cypher</p>
            </div>

            {/* Query Type Selection */}
            <div className="bg-white rounded-lg border p-6">
                <h3 className="text-lg font-semibold mb-4">1. Query-Typ auswählen</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {queryTypes.map(type => (
                        <div
                            key={type.id}
                            onClick={() => {
                                setQueryType(type.id);
                                setQueryResults(null);
                                setQueryError(null);
                            }}
                            className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                                queryType === type.id
                                    ? 'border-blue-500 bg-blue-50'
                                    : 'border-gray-200 hover:border-gray-300'
                            }`}
                        >
                            <div className="font-medium text-sm">{type.label}</div>
                            <div className="text-xs text-gray-500 mt-1">{type.desc}</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Browse Data Mode */}
            {queryType === 'browse_data' && (
                <div className="bg-white rounded-lg border p-6">
                    <div className="text-center mb-4">
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">📋 Datenbank-Inhalt durchsuchen</h3>
                        <p className="text-gray-600">Zeigt alle verfügbaren Entity-Typen und deren Inhalte in beiden Datenbanken an</p>
                    </div>
                    <DataViewer />
                </div>
            )}

            {/* Structured Query Builder */}
            {queryType === 'find_related' && (
                <div className="bg-white rounded-lg border p-6">
                    <h3 className="text-lg font-semibold mb-4">2. Query Parameter</h3>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Entity Type */}
                        <div>
                            <label className="block text-sm font-medium mb-2">Entity-Typ</label>
                            <select
                                value={selectedEntityType}
                                onChange={(e) => {
                                    setSelectedEntityType(e.target.value);
                                    setSelectedEntity('');
                                    setRelationshipType('');
                                    setQueryResults(null);
                                    setQueryError(null);
                                }}
                                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                            >
                                {entityTypes.map(type => (
                                    <option key={type.id} value={type.id}>{type.label}</option>
                                ))}
                            </select>
                        </div>

                        {/* Entity Selection with Autocomplete */}
                        <div>
                            <label className="block text-sm font-medium mb-2">Spezifische Entity</label>
                            <AutocompleteInput />
                        </div>

                        {/* Relationship Type */}
                        <div>
                            <label className="block text-sm font-medium mb-2">Beziehungstyp</label>
                            <select
                                value={relationshipType}
                                onChange={(e) => {
                                    setRelationshipType(e.target.value);
                                    setQueryResults(null);
                                    setQueryError(null);
                                }}
                                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                disabled={!selectedEntityType}
                            >
                                <option value="">Beziehung wählen...</option>
                                {relationships[selectedEntityType]?.map(rel => (
                                    <option key={rel.id} value={rel.id}>{rel.label}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>
            )}

            {/* Generated Queries Preview */}
            {generatePseudoQuery() && queryType !== 'browse_data' && (
                <div className="bg-white rounded-lg border p-6">
                    <h3 className="text-lg font-semibold mb-4">3. Query-Vorschau</h3>

                    {/* Pseudo Query */}
                    <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                        <h4 className="font-medium text-gray-700 mb-2">📝 Natürliche Sprache:</h4>
                        <p className="text-gray-800">{generatePseudoQuery()}</p>
                    </div>

                    {/* Generated Queries */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Oracle PGQL */}
                        <div className="space-y-2">
                            <h4 className="font-medium text-red-700 flex items-center">
                                <Database size={16} className="mr-1" />
                                Oracle PGQL
                            </h4>
                            <pre className="bg-red-50 p-4 rounded-lg text-sm overflow-x-auto border border-red-200">
                                <code>{generatePGQL()}</code>
                            </pre>
                        </div>

                        {/* Memgraph Cypher */}
                        <div className="space-y-2">
                            <h4 className="font-medium text-blue-700 flex items-center">
                                <GitBranch size={16} className="mr-1" />
                                Memgraph Cypher
                            </h4>
                            <pre className="bg-blue-50 p-4 rounded-lg text-sm overflow-x-auto border border-blue-200">
                                <code>{generateCypher()}</code>
                            </pre>
                        </div>
                    </div>

                    {/* Execute Button */}
                    <div className="mt-6 flex justify-center">
                        <button
                            onClick={executeQuery}
                            disabled={queryLoading || !selectedEntity || !relationshipType}
                            className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium ${
                                queryLoading || !selectedEntity || !relationshipType
                                    ? 'bg-gray-400 text-white cursor-not-allowed'
                                    : 'bg-green-600 text-white hover:bg-green-700'
                            }`}
                        >
                            {queryLoading ? (
                                <>
                                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                                    Query wird ausgeführt...
                                </>
                            ) : (
                                <>
                                    <Play size={16} />
                                    Query ausführen
                                </>
                            )}
                        </button>
                    </div>
                </div>
            )}

            {/* Query Results */}
            <QueryResultsDisplay />
        </div>
    );
};

export default QueryBuilder;