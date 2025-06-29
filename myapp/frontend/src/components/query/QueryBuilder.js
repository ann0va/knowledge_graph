// =============================================================================
// 5. 📁 src/components/query/QueryBuilder.js - MAIN INTERFACE (REFACTORED)
// =============================================================================

import React, { useState } from 'react';
import { Search, Route, BarChart3, Database } from 'lucide-react';
import EntityFinder from './EntityFinder';
import PathFinder from './PathFinder';
import RelationshipCounter from './RelationshipCounter';
import DataViewer from './DataViewer';

const QueryBuilder = () => {
    const [activeQueryType, setActiveQueryType] = useState('find_related');

    const queryTypes = [
        {
            id: 'find_related',
            label: '🔍 Verwandte Entitäten finden',
            desc: 'Finde Entitäten, die mit einer bestimmten Entität verbunden sind',
            component: EntityFinder
        },
        {
            id: 'find_path',
            label: '🛤️ Pfad finden',
            desc: 'Finde einen Pfad zwischen zwei Entitäten',
            component: PathFinder
        },
        {
            id: 'count_relations',
            label: '📊 Beziehungen zählen',
            desc: 'Zähle die Beziehungen einer Entität',
            component: RelationshipCounter
        },
        {
            id: 'browse_data',
            label: '📋 Datenbank durchsuchen',
            desc: 'Zeige alle verfügbaren Daten in beiden Datenbanken an',
            component: DataViewer
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

            {/* Query Type Selection */}
            <div className="bg-white rounded-lg border p-6">
                <h3 className="text-lg font-semibold mb-4">Query-Typ auswählen</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {queryTypes.map(type => (
                        <div
                            key={type.id}
                            onClick={() => setActiveQueryType(type.id)}
                            className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                                activeQueryType === type.id
                                    ? 'border-blue-500 bg-blue-50'
                                    : 'border-gray-200 hover:border-gray-300'
                            }`}
                        >
                            <div className="font-medium text-sm flex items-center">
                                {type.label}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">{type.desc}</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Active Component */}
            <ActiveComponent />
        </div>
    );
};

export default QueryBuilder;