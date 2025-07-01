// =============================================================================
// 4. 📁 src/components/query/PathFinder.js - PATH FINDING
// =============================================================================

import React, { useState } from 'react';
import { Route, Search } from 'lucide-react';
import EntityDropdown from './shared/EntityDropdown';
import QueryResults from './shared/QueryResults';
import { QueryInterface } from './shared/QueryInterface';
// import GraphResultsVisualizer from '../visualization/GraphResultsVisualizer';


const PathFinder = () => {
    const [selectedEntity, setSelectedEntity] = useState('');
    const [selectedEntityType, setSelectedEntityType] = useState('person');
    const [targetEntity, setTargetEntity] = useState('');
    const [targetEntityType, setTargetEntityType] = useState('person');
    const [queryResults, setQueryResults] = useState(null);
    const [queryLoading, setQueryLoading] = useState(false);
    const [queryError, setQueryError] = useState(null);
    const [validationError, setValidationError] = useState('');

    const queryInterface = new QueryInterface();

    const entityTypes = [
        { id: 'person', label: 'Person' },
        { id: 'award', label: 'Auszeichnung' },
        { id: 'field', label: 'Fachbereich' },
        { id: 'place', label: 'Ort' },
        { id: 'work', label: 'Werk' },
        { id: 'workplace', label: 'Arbeitsplatz' },
        { id: 'occupation', label: 'Beruf' }
    ];

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

    const validateQuery = () => {
        const startError = queryInterface.validateNotEmpty(selectedEntity, 'Start-Entity');
        if (startError) {
            setValidationError(startError);
            return false;
        }

        const targetError = queryInterface.validateNotEmpty(targetEntity, 'Ziel-Entity');
        if (targetError) {
            setValidationError(targetError);
            return false;
        }

        const differentError = queryInterface.validateEntitiesDifferent(
            selectedEntity, targetEntity, selectedEntityType, targetEntityType
        );
        if (differentError) {
            setValidationError(differentError);
            return false;
        }

        setValidationError('');
        return true;
    };

    const executeQuery = async () => {
        if (!validateQuery()) return;

        setQueryLoading(true);
        setQueryError(null);
        setQueryResults(null);

        const queryData = {
            queryType: 'find_path',
            entityType: selectedEntityType,
            entityName: selectedEntity,
            targetEntityType: targetEntityType,
            targetEntityName: targetEntity,
            database: 'both'
        };

        const result = await queryInterface.executeQuery(queryData);

        if (result.success) {
            setQueryResults(result.data);
        } else {
            setQueryError(result.error);
        }

        setQueryLoading(false);
    };

    return (
        <div className="space-y-6">
            <div className="bg-white rounded-lg border p-6">
                <h3 className="text-lg font-semibold mb-4">🛤️ Pfad zwischen Entitäten finden</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    {/* Start Entity */}
                    <div className="space-y-4">
                        <h4 className="font-medium text-green-700 flex items-center">
                            🚀 Start-Entity
                        </h4>

                        <div>
                            <label className="block text-sm font-medium mb-2">Start Entity-Typ</label>
                            <select
                                value={selectedEntityType}
                                onChange={(e) => {
                                    setSelectedEntityType(e.target.value);
                                    setSelectedEntity('');
                                    setQueryResults(null);
                                    setQueryError(null);
                                }}
                                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-green-500"
                            >
                                {entityTypes.map(type => (
                                    <option key={type.id} value={type.id}>{type.label}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-2">Start Entity</label>
                            <EntityDropdown
                                value={selectedEntity}
                                onChange={setSelectedEntity}
                                entityType={selectedEntityType}
                                placeholder={`${getEntityTypeLabel(selectedEntityType)} auswählen...`}
                            />
                        </div>
                    </div>

                    {/* Target Entity */}
                    <div className="space-y-4">
                        <h4 className="font-medium text-blue-700 flex items-center">
                            🎯 Ziel-Entity
                        </h4>

                        <div>
                            <label className="block text-sm font-medium mb-2">Ziel Entity-Typ</label>
                            <select
                                value={targetEntityType}
                                onChange={(e) => {
                                    setTargetEntityType(e.target.value);
                                    setTargetEntity('');
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

                        <div>
                            <label className="block text-sm font-medium mb-2">Ziel Entity</label>
                            <EntityDropdown
                                value={targetEntity}
                                onChange={setTargetEntity}
                                entityType={targetEntityType}
                                placeholder={`${getEntityTypeLabel(targetEntityType)} auswählen...`}
                            />
                        </div>
                    </div>
                </div>

                {/* Validation Error */}
                {validationError && (
                    <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                        <div className="flex items-center">
                            <div className="text-amber-600 mr-2">⚠️</div>
                            <div className="text-amber-800 font-medium">{validationError}</div>
                        </div>
                    </div>
                )}

                {/* Execute Button */}
                <div className="mt-6 flex justify-center">
                    <button
                        onClick={executeQuery}
                        disabled={queryLoading}
                        className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium ${
                            queryLoading
                                ? 'bg-gray-400 text-white cursor-not-allowed'
                                : 'bg-purple-600 text-white hover:bg-purple-700'
                        }`}
                    >
                        {queryLoading ? (
                            <>
                                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                                Pfad wird gesucht...
                            </>
                        ) : (
                            <>
                                <Route size={16} />
                                Pfad finden
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Results */}
            <QueryResults
                results={queryResults}
                error={queryError}
                queryType="find_path"
            />

            {/*/!* Graph Visualization - FIXED *!/*/}
            {/*{queryResults && (*/}
            {/*    <div className="mt-6">*/}
            {/*        <GraphResultsVisualizer*/}
            {/*            results={queryResults}*/}
            {/*            title="🛤️ Path Results - Graph View"*/}
            {/*            height="400px"*/}
            {/*        />*/}
            {/*    </div>*/}
            {/*)}*/}
        </div>
    );
};

export default PathFinder;