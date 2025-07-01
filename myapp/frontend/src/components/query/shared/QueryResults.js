// src/components/query/shared/QueryResults.js - Universal Results Display
import React from 'react';
import { Database, AlertCircle, CheckCircle, BarChart3, Route, Users, TrendingUp } from 'lucide-react';

const QueryResults = ({ results, error, queryType }) => {
    // Error Display
    if (error) {
        return (
            <div className="bg-white rounded-lg border p-6">
                <h3 className="text-lg font-semibold mb-4 text-red-600 flex items-center">
                    <AlertCircle size={20} className="mr-2" />
                    ❌ Query Fehler
                </h3>
                <div className="p-4 bg-red-50 border border-red-200 rounded text-red-700">
                    {error}
                </div>
            </div>
        );
    }

    // No Results
    if (!results) return null;

    // Query Type Specific Icons
    const getQueryIcon = () => {
        switch (queryType) {
            case 'find_related': return <Users size={20} className="mr-2" />;
            case 'find_path': return <Route size={20} className="mr-2" />;
            case 'count_relations': return <BarChart3 size={20} className="mr-2" />;
            default: return <Database size={20} className="mr-2" />;
        }
    };

    // Query Type Specific Labels
    const getQueryLabel = () => {
        switch (queryType) {
            case 'find_related': return 'Verwandte Entitäten';
            case 'find_path': return 'Pfad-Ergebnisse';
            case 'count_relations': return 'Beziehungs-Statistiken';
            default: return 'Query-Ergebnisse';
        }
    };

    return (
        <div className="bg-white rounded-lg border p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
                {getQueryIcon()}
                {getQueryLabel()}
            </h3>

            {/* Side-by-Side Results Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Oracle Results */}
                {results.results?.oracle && (
                    <div className="space-y-4">
                        <h4 className="font-medium text-red-700 mb-3 flex items-center">
                            <Database size={16} className="mr-1" />
                            Oracle Ergebnisse
                            {queryType === 'count_relations' ?
                                ` (${results.results.oracle.totalCount || 0})` :
                                queryType === 'find_path' ?
                                    ` (${results.results.oracle.pathsFound || 0})` :
                                    ` (${results.results.oracle.count || 0})`
                            }
                        </h4>

                        {results.results.oracle.error ? (
                            <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                                ❌ {results.results.oracle.error}
                            </div>
                        ) : (
                            <OracleResultsDisplay
                                data={results.results.oracle}
                                queryType={queryType}
                            />
                        )}
                    </div>
                )}

                {/* Memgraph Results */}
                {results.results?.memgraph && (
                    <div className="space-y-4">
                        <h4 className="font-medium text-blue-700 mb-3 flex items-center">
                            <Database size={16} className="mr-1" />
                            Memgraph Ergebnisse
                            {queryType === 'count_relations' ?
                                ` (${results.results.memgraph.totalCount || 0})` :
                                queryType === 'find_path' ?
                                    ` (${results.results.memgraph.pathsFound || 0})` :
                                    ` (${results.results.memgraph.count || 0})`
                            }
                        </h4>

                        {results.results.memgraph.error ? (
                            <div className="p-3 bg-blue-50 border border-blue-200 rounded text-blue-700 text-sm">
                                ❌ {results.results.memgraph.error}
                            </div>
                        ) : (
                            <MemgraphResultsDisplay
                                data={results.results.memgraph}
                                queryType={queryType}
                            />
                        )}
                    </div>
                )}
            </div>

            {/* Generated Queries */}
            {results.generatedQueries && (
                <div className="mt-6">
                    <h4 className="font-medium mb-3">🔧 Generierte Queries</h4>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div>
                            <h5 className="text-sm font-medium text-red-700 mb-2">Oracle PGQL:</h5>
                            <pre className="bg-red-50 p-3 rounded text-xs overflow-x-auto border border-red-200">
                                <code>{results.generatedQueries.oracle}</code>
                            </pre>
                        </div>
                        <div>
                            <h5 className="text-sm font-medium text-blue-700 mb-2">Memgraph Cypher:</h5>
                            <pre className="bg-blue-50 p-3 rounded text-xs overflow-x-auto border border-blue-200">
                                <code>{results.generatedQueries.memgraph}</code>
                            </pre>
                        </div>
                    </div>
                </div>
            )}

            {/* Metadata */}
            {results.metadata && (
                <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded text-xs">
                    <strong>Query Metadata:</strong>
                    <br />
                    Ausgeführt auf: {results.metadata.executedOn}
                    <br />
                    Zeitstempel: {new Date(results.metadata.timestamp).toLocaleString()}
                    {results.query && (
                        <>
                            <br />
                            Query-Typ: {results.query.type}
                            <br />
                            Entity: {results.query.entity}
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

// Oracle Results Display Component
const OracleResultsDisplay = ({ data, queryType }) => {
    if (queryType === 'count_relations') {
        return <OracleCountResults data={data} />;
    } else if (queryType === 'find_path') {
        return <OraclePathResults data={data} />;
    } else {
        return <OracleRelationshipResults data={data} />;
    }
};

// Memgraph Results Display Component
const MemgraphResultsDisplay = ({ data, queryType }) => {
    if (queryType === 'count_relations') {
        return <MemgraphCountResults data={data} />;
    } else if (queryType === 'find_path') {
        return <MemgraphPathResults data={data} />;
    } else {
        return <MemgraphRelationshipResults data={data} />;
    }
};

// Oracle Count Results
const OracleCountResults = ({ data }) => {
    const { totalCount, relationshipCounts, summary } = data;

    return (
        <div className="space-y-3">
            <div className="p-3 bg-red-50 border border-red-200 rounded">
                <div className="flex items-center justify-between">
                    <span className="font-medium">Gesamt:</span>
                    <span className="text-lg font-bold text-red-700">{totalCount}</span>
                </div>
                <div className="text-sm text-gray-600 mt-1">{summary}</div>
            </div>

            {relationshipCounts && Object.keys(relationshipCounts).length > 0 && (
                <div className="space-y-2">
                    <h5 className="font-medium text-sm">Aufschlüsselung nach Typ:</h5>
                    {Object.entries(relationshipCounts)
                        .sort(([,a], [,b]) => b - a) // Sort by count descending
                        .map(([relType, count]) => (
                            <div key={relType} className="flex items-center justify-between p-2 bg-red-25 border border-red-100 rounded text-sm">
                                <span className="font-medium">{relType}</span>
                                <span className="bg-red-100 px-2 py-1 rounded text-xs font-bold">{count}</span>
                            </div>
                        ))}
                </div>
            )}
        </div>
    );
};

// Memgraph Count Results
const MemgraphCountResults = ({ data }) => {
    const { totalCount, relationshipCounts, summary } = data;

    return (
        <div className="space-y-3">
            <div className="p-3 bg-blue-50 border border-blue-200 rounded">
                <div className="flex items-center justify-between">
                    <span className="font-medium">Gesamt:</span>
                    <span className="text-lg font-bold text-blue-700">{totalCount}</span>
                </div>
                <div className="text-sm text-gray-600 mt-1">{summary}</div>
            </div>

            {relationshipCounts && Object.keys(relationshipCounts).length > 0 && (
                <div className="space-y-2">
                    <h5 className="font-medium text-sm">Aufschlüsselung nach Typ:</h5>
                    {Object.entries(relationshipCounts)
                        .sort(([,a], [,b]) => b - a) // Sort by count descending
                        .map(([relType, count]) => (
                            <div key={relType} className="flex items-center justify-between p-2 bg-blue-25 border border-blue-100 rounded text-sm">
                                <span className="font-medium">{relType}</span>
                                <span className="bg-blue-100 px-2 py-1 rounded text-xs font-bold">{count}</span>
                            </div>
                        ))}
                </div>
            )}
        </div>
    );
};

// In OraclePathResults - Fix für "Pfad-Details verfügbar"
const OraclePathResults = ({ data }) => {
    const { paths, pathsFound } = data;

    if (pathsFound === 0) {
        return (
            <div className="p-3 bg-gray-50 border border-gray-200 rounded text-gray-600 text-sm">
                ℹ️ Kein Pfad gefunden
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {paths.map((path, idx) => (
                <div key={idx} className="p-3 bg-red-50 border border-red-200 rounded text-sm">
                    <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">Pfad #{idx + 1}</span>
                        <span className="bg-red-100 px-2 py-1 rounded text-xs">
                            Länge: {path.length}
                        </span>
                    </div>

                    {/* ✅ NEU: Oracle Pfad-Details anzeigen */}
                    {path.startName && path.endName ? (
                        <div className="text-xs">
                            <strong>Pfad:</strong> {path.startName} → {path.endName}
                        </div>
                    ) : (
                        <div className="text-xs text-gray-600">
                            📊 Pfad gefunden (Details limitiert)
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
};

// Memgraph Path Results
const MemgraphPathResults = ({ data }) => {
    const { paths, pathsFound, queryInfo } = data;

    if (pathsFound === 0) {
        return (
            <div className="p-3 bg-gray-50 border border-gray-200 rounded text-gray-600 text-sm">
                <div className="flex items-center">
                    <AlertCircle size={16} className="mr-2" />
                    ℹ️ {queryInfo?.message || 'Kein Pfad gefunden'}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {paths.map((path, idx) => (
                <div key={idx} className="p-3 bg-blue-50 border border-blue-200 rounded text-sm">
                    <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">Pfad #{idx + 1}</span>
                        <span className="bg-blue-100 px-2 py-1 rounded text-xs">
                            Länge: {path.length}
                        </span>
                    </div>

                    {path.nodes && path.nodes.length > 0 && (
                        <div className="space-y-2">
                            <div className="text-xs">
                                <strong>Pfad:</strong>
                            </div>
                            <div className="flex flex-wrap gap-1">
                                {path.nodes.map((node, nodeIdx) => (
                                    <React.Fragment key={nodeIdx}>
                                        <span className="bg-blue-100 px-2 py-1 rounded text-xs font-medium">
                                            {node.name || node.id}
                                        </span>
                                        {nodeIdx < path.nodes.length - 1 && (
                                            <span className="text-gray-400 text-xs self-center">→</span>
                                        )}
                                    </React.Fragment>
                                ))}
                            </div>

                            {path.relationships && path.relationships.length > 0 && (
                                <div className="text-xs text-gray-600">
                                    <strong>Beziehungen:</strong> {path.relationships.map(rel => rel.type).join(', ')}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
};

// Oracle Relationship Results
const OracleRelationshipResults = ({ data }) => {
    const { relationships } = data;

    if (!relationships || relationships.length === 0) {
        return (
            <div className="p-3 bg-gray-50 border border-gray-200 rounded text-gray-600 text-sm">
                ℹ️ Keine Ergebnisse gefunden
            </div>
        );
    }

    return (
        <div className="space-y-2 max-h-96 overflow-y-auto">
            {relationships.map((rel, idx) => (
                <div key={idx} className="p-3 bg-red-50 rounded border border-red-200 text-sm">
                    <div className="font-medium">{rel.target_name || rel.TARGET_NAME || 'Unbekannt'}</div>
                    <div className="text-gray-600">ID: {rel.target_entity_id || rel.TARGET_VERTEX_ID || 'N/A'}</div>
                    <div className="text-xs text-gray-500">
                        Typ: {rel.relationship_type || rel.RELATIONSHIP_TYPE || 'N/A'}
                    </div>
                </div>
            ))}
        </div>
    );
};

// Memgraph Relationship Results
const MemgraphRelationshipResults = ({ data }) => {
    const { relationships } = data;

    if (!relationships || relationships.length === 0) {
        return (
            <div className="p-3 bg-gray-50 border border-gray-200 rounded text-gray-600 text-sm">
                ℹ️ Keine Ergebnisse gefunden
            </div>
        );
    }

    return (
        <div className="space-y-2 max-h-96 overflow-y-auto">
            {relationships.map((rel, idx) => (
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
    );
};

export default QueryResults;