// =============================================================================
// 📁 src/components/query/QueryBuilder.js - COMPLETE INTERFACE (with UPDATE)
// =============================================================================

import React, { useState } from 'react';
import EntityFinder from './EntityFinder';
import PathFinder from './PathFinder';
import RelationshipCounter from './RelationshipCounter';
import DataViewer from './DataViewer';
import NodeCreator from './NodeCreator';
import EdgeCreator from './EdgeCreator';
import PersonUpdater from './PersonUpdater';
import NodeDeleter from './NodeDeleter';
import EdgeDeleter from './EdgeDeleter';
import GraphVisualizer from '../visualization/GraphVisualizer';



const QueryBuilder = () => {
    const [activeQueryType, setActiveQueryType] = useState('find_related');

    const queryTypes = [
        // Query Operations
        {
            id: 'find_related',
            label: '🔍 Verwandte Entitäten finden',
            desc: 'Finde Entitäten, die mit einer bestimmten Entität verbunden sind',
            component: EntityFinder,
            category: 'query'
        },
        {
            id: 'find_path',
            label: '🛤️ Pfad finden',
            desc: 'Finde einen Pfad zwischen zwei Entitäten',
            component: PathFinder,
            category: 'query'
        },
        {
            id: 'count_relations',
            label: '📊 Beziehungen zählen',
            desc: 'Zähle die Beziehungen einer Entität',
            component: RelationshipCounter,
            category: 'query'
        },
        {
            id: 'browse_data',
            label: '📋 Datenbank durchsuchen',
            desc: 'Zeige alle verfügbaren Daten in beiden Datenbanken an',
            component: DataViewer,
            category: 'query'
        },
        // Create Operations
        {
            id: 'create_node',
            label: '➕ Knoten erstellen',
            desc: 'Erstelle eine neue Entity in der Datenbank',
            component: NodeCreator,
            category: 'create'
        },
        {
            id: 'create_edge',
            label: '🔗 Beziehung erstellen',
            desc: 'Verbinde zwei existierende Entities',
            component: EdgeCreator,
            category: 'create'
        },
        // Update Operations
        {
            id: 'update_person',
            label: '✏️ Person bearbeiten',
            desc: 'Eigenschaften einer Person aktualisieren (Name, Geburtsdatum, etc.)',
            component: PersonUpdater,
            category: 'update'
        },
        // Delete Operations
        {
            id: 'delete_node',
            label: '🗑️ Knoten löschen',
            desc: 'Lösche eine Entity und alle ihre Beziehungen',
            component: NodeDeleter,
            category: 'delete'
        },
        {
            id: 'delete_edge',
            label: '🔥 Beziehung löschen',
            desc: 'Lösche eine spezifische Beziehung zwischen zwei Entities',
            component: EdgeDeleter,
            category: 'delete'
        },
        // Visualization
        {
            id: 'visualize_graph',
            label: '🎨 Graph Visualisierung',
            desc: 'Interaktive Visualisierung der Knowledge Graph Daten',
            component: GraphVisualizer,
            category: 'visualization'
        }
    ];

    const ActiveComponent = queryTypes.find(qt => qt.id === activeQueryType)?.component || EntityFinder;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="text-center">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">🔍 Query Builder</h2>
                <p className="text-gray-600">Strukturierte Abfrage-Erstellung für Oracle PGQL und Memgraph Cypher</p>
            </div>

            {/* Query Type Selection mit Kategorien */}
            <div className="bg-white rounded-lg border p-6">
                <h3 className="text-lg font-semibold mb-4">Query-Typ auswählen</h3>

                {/* CREATE Category */}
                <div className="mb-6">
                    <h4 className="text-md font-medium text-gray-700 mb-3 flex items-center gap-2">
                        ➕ CREATE Operationen
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {queryTypes.filter(type => type.category === 'create').map(type => (
                            <div
                                key={type.id}
                                onClick={() => setActiveQueryType(type.id)}
                                className={`p-3 border-2 rounded-lg cursor-pointer transition-all ${
                                    activeQueryType === type.id
                                        ? 'border-green-500 bg-green-50'
                                        : 'border-gray-200 hover:border-gray-300'
                                }`}
                            >
                                <div className="font-medium text-sm text-green-700">{type.label}</div>
                                <div className="text-xs text-gray-500 mt-1">{type.desc}</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* READ Category */}
                <div className="mb-6">
                    <h4 className="text-md font-medium text-gray-700 mb-3 flex items-center gap-2">
                        🔍 READ Operationen
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                        {queryTypes.filter(type => type.category === 'query').map(type => (
                            <div
                                key={type.id}
                                onClick={() => setActiveQueryType(type.id)}
                                className={`p-3 border-2 rounded-lg cursor-pointer transition-all ${
                                    activeQueryType === type.id
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

                {/* UPDATE Category */}
                <div className="mb-6">
                    <h4 className="text-md font-medium text-gray-700 mb-3 flex items-center gap-2">
                        ✏️ UPDATE Operationen
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {queryTypes.filter(type => type.category === 'update').map(type => (
                            <div
                                key={type.id}
                                onClick={() => setActiveQueryType(type.id)}
                                className={`p-3 border-2 rounded-lg cursor-pointer transition-all ${
                                    activeQueryType === type.id
                                        ? 'border-orange-500 bg-orange-50'
                                        : 'border-gray-200 hover:border-gray-300'
                                }`}
                            >
                                <div className="font-medium text-sm text-orange-700">{type.label}</div>
                                <div className="text-xs text-gray-500 mt-1">{type.desc}</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* DELETE Category */}
                <div className="mb-6">
                    <h4 className="text-md font-medium text-gray-700 mb-3 flex items-center gap-2">
                        🗑️ DELETE Operationen
                        <span className="text-xs text-red-600 bg-red-100 px-2 py-1 rounded">GEFAHR</span>
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {queryTypes.filter(type => type.category === 'delete').map(type => (
                            <div
                                key={type.id}
                                onClick={() => setActiveQueryType(type.id)}
                                className={`p-3 border-2 rounded-lg cursor-pointer transition-all ${
                                    activeQueryType === type.id
                                        ? 'border-red-500 bg-red-50'
                                        : 'border-red-200 hover:border-red-300'
                                }`}
                            >
                                <div className="font-medium text-sm text-red-700">{type.label}</div>
                                <div className="text-xs text-red-600 mt-1">{type.desc}</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* VISUALIZATION Category */}
                <div className="mb-6">
                    <h4 className="text-md font-medium text-gray-700 mb-3 flex items-center gap-2">
                        🎨 Visualization
                    </h4>
                    <div className="grid grid-cols-1 gap-3">
                        {queryTypes.filter(type => type.category === 'visualization').map(type => (
                            <div
                                key={type.id}
                                onClick={() => setActiveQueryType(type.id)}
                                className={`p-3 border-2 rounded-lg cursor-pointer transition-all ${
                                    activeQueryType === type.id
                                        ? 'border-purple-500 bg-purple-50'
                                        : 'border-gray-200 hover:border-gray-300'
                                }`}
                            >
                                <div className="font-medium text-sm text-purple-700">{type.label}</div>
                                <div className="text-xs text-gray-500 mt-1">{type.desc}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Active Component */}
            <ActiveComponent />
        </div>
    );
};

export default QueryBuilder;