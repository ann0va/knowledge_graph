// src/components/query/RelationshipCounter.js - COMPLETE CLEAN VERSION
import React, { useState } from 'react';
import { BarChart3, TrendingUp, Database } from 'lucide-react';
import EntityDropdown from './shared/EntityDropdown';
import QueryResults from './shared/QueryResults';
import { QueryInterface } from './shared/QueryInterface';
import apiService from "../../services/api";

const RelationshipCounter = () => {
    const [selectedEntity, setSelectedEntity] = useState('');
    const [selectedEntityType, setSelectedEntityType] = useState('person');
    const [countMode, setCountMode] = useState('all'); // 'all', 'outgoing', 'incoming', 'specific'
    const [specificRelationshipType, setSpecificRelationshipType] = useState('');
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

    const countModes = [
        { id: 'all', label: 'Alle Beziehungen', desc: 'Zähle alle ein- und ausgehenden Beziehungen' },
        { id: 'outgoing', label: 'Ausgehende Beziehungen', desc: 'Zähle nur ausgehende Beziehungen' },
        { id: 'incoming', label: 'Eingehende Beziehungen', desc: 'Zähle nur eingehende Beziehungen' },
        { id: 'specific', label: 'Spezifischer Typ', desc: 'Zähle nur einen bestimmten Beziehungstyp' }
    ];

    const relationships = {
        person: [
            { id: 'WORKS_IN', label: 'Arbeitet in Bereich' },
            { id: 'HAS_OCCUPATION', label: 'Hat Beruf' },
            { id: 'RECEIVED', label: 'Erhielt Auszeichnung' },
            { id: 'BIRTH_IN', label: 'Wurde geboren in' },
            { id: 'DIED_IN', label: 'Starb in' },
            { id: 'WORKED_AT', label: 'Arbeitete bei' },
            { id: 'CREATED', label: 'Erschuf Werk' },
            { id: 'STUDENT_OF', label: 'War Student von' },
            { id: 'ADVISED', label: 'Betreute' },
            { id: 'PARTNER_OF', label: 'War Partner von' },
            { id: 'RELATIVE_OF', label: 'Ist verwandt mit' },
            { id: 'INFLUENCED_BY', label: 'Wurde beeinflusst von' },
            { id: 'SIGNIFICANT_PERSON_FOR', label: 'War bedeutsam für' },
            { id: 'FATHER_OF', label: 'Ist Vater von' },
            { id: 'MOTHER_OF', label: 'Ist Mutter von' },
            { id: 'NATIONAL_OF', label: 'Ist Staatsangehöriger von' }
        ],
        award: [
            { id: 'AWARDED_TO', label: 'Wurde verliehen an' },
            { id: 'IN_FIELD', label: 'Ist im Bereich' }
        ],
        field: [
            { id: 'WORKED_BY', label: 'Wird bearbeitet von' }
        ],
        place: [
            { id: 'BIRTH_PLACE_OF', label: 'Ist Geburtsort von' },
            { id: 'DEATH_PLACE_OF', label: 'Ist Sterbeort von' },
            { id: 'WORKPLACE_IN', label: 'Hat Arbeitsplätze' }
        ],
        work: [
            { id: 'CREATED_BY', label: 'Wurde erschaffen von' }
        ],
        workplace: [
            { id: 'EMPLOYED', label: 'Beschäftigte' }
        ],
        occupation: [
            { id: 'HELD_BY', label: 'Wird ausgeübt von' }
        ]
    };

    const validateQuery = () => {
        const entityError = queryInterface.validateNotEmpty(selectedEntity, 'Entity');
        if (entityError) {
            setValidationError(entityError);
            return false;
        }

        if (countMode === 'specific') {
            const relationshipError = queryInterface.validateNotEmpty(specificRelationshipType, 'Spezifischer Beziehungstyp');
            if (relationshipError) {
                setValidationError(relationshipError);
                return false;
            }
        }

        setValidationError('');
        return true;
    };

    // 🎯 MAIN: Execute Query mit allen Modi
    const executeQuery = async () => {
        if (!validateQuery()) return;

        setQueryLoading(true);
        setQueryError(null);
        setQueryResults(null);

        try {
            let combinedResults = null;

            if (countMode === 'all') {
                // ✅ FIXED: Kombiniere incoming und outgoing für "alle"
                console.log('🔄 Executing ALL relationships query (outgoing + incoming)');
                const [outgoingResult, incomingResult] = await Promise.all([
                    executeDirectionalQuery('outgoing'),
                    executeDirectionalQuery('incoming')
                ]);

                if (outgoingResult.success && incomingResult.success) {
                    combinedResults = combineDirectionalResults(outgoingResult.data, incomingResult.data);
                } else {
                    setQueryError(outgoingResult.error || incomingResult.error || 'Query failed');
                    return;
                }
            } else if (countMode === 'outgoing') {
                // ✅ WORKING: Nur ausgehende Beziehungen
                console.log('🔄 Executing OUTGOING relationships query');
                const result = await executeDirectionalQuery('outgoing');
                if (result.success) {
                    combinedResults = result.data;
                } else {
                    setQueryError(result.error);
                    return;
                }
            } else if (countMode === 'incoming') {
                // ✅ WORKING: Nur eingehende Beziehungen
                console.log('🔄 Executing INCOMING relationships query');
                const result = await executeDirectionalQuery('incoming');
                if (result.success) {
                    combinedResults = result.data;
                } else {
                    setQueryError(result.error);
                    return;
                }
            } else if (countMode === 'specific') {
                // ✅ WORKING: Spezifischer Typ in beide Richtungen
                console.log(`🔄 Executing SPECIFIC relationship query for ${specificRelationshipType}`);
                const [outgoingResult, incomingResult] = await Promise.all([
                    executeDirectionalQuery('outgoing', specificRelationshipType),
                    executeDirectionalQuery('incoming', specificRelationshipType)
                ]);

                if (outgoingResult.success && incomingResult.success) {
                    combinedResults = combineDirectionalResults(outgoingResult.data, incomingResult.data);
                } else {
                    setQueryError(outgoingResult.error || incomingResult.error || 'Query failed');
                    return;
                }
            }

            if (combinedResults) {
                const transformedResult = transformToCountResult(combinedResults, countMode);
                setQueryResults(transformedResult);
            }

        } catch (error) {
            console.error('❌ Relationship count error:', error);
            setQueryError(error.message);
        } finally {
            setQueryLoading(false);
        }
    };

    // 🎯 DIRECTIONAL: Führe richtungsspezifische Query aus
    const executeDirectionalQuery = async (direction, specificRelType = null) => {
        console.log(`🔄 Executing ${direction} query${specificRelType ? ` for ${specificRelType}` : ''}`);

        if (direction === 'outgoing') {
            // ✅ WORKING: Verwende find_related für ausgehende Beziehungen
            const queryData = {
                queryType: 'find_related',
                entityType: selectedEntityType,
                entityName: selectedEntity,
                relationshipType: specificRelType,
                database: 'both'
            };
            return await queryInterface.executeQuery(queryData);
        } else {
            // ✅ WORKING: Für eingehende Beziehungen verwende Raw Queries
            return await executeIncomingRelationshipsQuery(specificRelType);
        }
    };

    // 🎯 INCOMING: Eingehende Beziehungen über Raw Queries
    const executeIncomingRelationshipsQuery = async (specificRelType = null) => {
        try {
            console.log(`🔄 Executing REAL incoming relationships query for ${selectedEntity}`);

            // Nutze die strukturierte Query API mit neuem 'find_incoming' Typ
            const queryData = {
                queryType: 'find_incoming',
                entityType: selectedEntityType,
                entityName: selectedEntity,
                relationshipType: specificRelType,
                database: 'both'
            };

            const result = await queryInterface.executeQuery(queryData);

            if (!result.success) {
                throw new Error(result.error || 'Incoming relationships query failed');
            }

            // Transformiere das Ergebnis in das erwartete Format
            return {
                success: true,
                data: {
                    query: {
                        type: 'find_incoming',
                        entity: `${selectedEntityType}:${selectedEntity}`,
                        relationship: specificRelType || 'all',
                        database: 'both'
                    },
                    results: result.data.results,
                    metadata: {
                        timestamp: new Date().toISOString(),
                        direction: 'incoming',
                        method: 'structured_api_with_real_incoming'
                    }
                }
            };

        } catch (error) {
            console.error('❌ Real incoming relationships query error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    };

    // 🎯 COMBINE: Kombiniere ausgehende und eingehende Ergebnisse
    const combineDirectionalResults = (outgoingData, incomingData) => {
        const combinedData = {
            ...outgoingData,
            results: {}
        };

        // Oracle Results kombinieren
        if (outgoingData.results?.oracle || incomingData.results?.oracle) {
            const oracleOutgoing = outgoingData.results?.oracle?.relationships || [];
            const oracleIncoming = incomingData.results?.oracle?.relationships || [];

            combinedData.results.oracle = {
                sourceEntity: outgoingData.results?.oracle?.sourceEntity || incomingData.results?.oracle?.sourceEntity,
                relationships: [
                    ...oracleOutgoing.map(rel => ({ ...rel, direction: 'outgoing' })),
                    ...oracleIncoming.map(rel => ({ ...rel, direction: 'incoming' }))
                ],
                count: oracleOutgoing.length + oracleIncoming.length,
                queryInfo: {
                    outgoingCount: oracleOutgoing.length,
                    incomingCount: oracleIncoming.length,
                    totalCount: oracleOutgoing.length + oracleIncoming.length
                }
            };
        }

        // Memgraph Results kombinieren
        if (outgoingData.results?.memgraph || incomingData.results?.memgraph) {
            const memgraphOutgoing = outgoingData.results?.memgraph?.relationships || [];
            const memgraphIncoming = incomingData.results?.memgraph?.relationships || [];

            combinedData.results.memgraph = {
                sourceEntity: outgoingData.results?.memgraph?.sourceEntity || incomingData.results?.memgraph?.sourceEntity,
                relationships: [
                    ...memgraphOutgoing.map(rel => ({ ...rel, direction: 'outgoing' })),
                    ...memgraphIncoming.map(rel => ({ ...rel, direction: 'incoming' }))
                ],
                count: memgraphOutgoing.length + memgraphIncoming.length,
                queryInfo: {
                    outgoingCount: memgraphOutgoing.length,
                    incomingCount: memgraphIncoming.length,
                    totalCount: memgraphOutgoing.length + memgraphIncoming.length
                }
            };
        }

        return combinedData;
    };

    // 🎯 TRANSFORM: Transformiere zu Count-Format
    const transformToCountResult = (originalResult, mode) => {
        const countResult = {
            ...originalResult,
            queryType: 'count_relations',
            countMode: mode,
            results: {}
        };

        // Oracle Results mit Direction Breakdown
        if (originalResult.results?.oracle) {
            const oracleRels = originalResult.results.oracle.relationships || [];
            const relationshipCounts = getRelationshipTypeCounts(oracleRels, 'oracle');
            const directionCounts = getDirectionCounts(oracleRels);

            countResult.results.oracle = {
                ...originalResult.results.oracle,
                totalCount: oracleRels.length,
                relationshipCounts,
                directionCounts,
                summary: `${oracleRels.length} Beziehungen gefunden (${directionCounts.outgoing} ausgehend, ${directionCounts.incoming} eingehend)`
            };
        }

        // Memgraph Results mit Direction Breakdown
        if (originalResult.results?.memgraph) {
            const memgraphRels = originalResult.results.memgraph.relationships || [];
            const relationshipCounts = getRelationshipTypeCounts(memgraphRels, 'memgraph');
            const directionCounts = getDirectionCounts(memgraphRels);

            countResult.results.memgraph = {
                ...originalResult.results.memgraph,
                totalCount: memgraphRels.length,
                relationshipCounts,
                directionCounts,
                summary: `${memgraphRels.length} Beziehungen gefunden (${directionCounts.outgoing} ausgehend, ${directionCounts.incoming} eingehend)`
            };
        }

        return countResult;
    };

    // 🎯 COUNT: Zähle Richtungen
    const getDirectionCounts = (relationships) => {
        const counts = { outgoing: 0, incoming: 0 };
        relationships.forEach(rel => {
            if (rel.direction === 'incoming') {
                counts.incoming++;
            } else {
                counts.outgoing++;
            }
        });
        return counts;
    };

    // 🎯 COUNT: Zähle Beziehungstypen
    const getRelationshipTypeCounts = (relationships, source) => {
        const counts = {};
        relationships.forEach(rel => {
            const relType = source === 'oracle'
                ? (rel.RELATIONSHIP_TYPE || rel.relationship_type || 'UNKNOWN')
                : (rel.relationship_type || 'UNKNOWN');
            counts[relType] = (counts[relType] || 0) + 1;
        });
        return counts;
    };

    const generateSummaryText = () => {
        const modeLabels = {
            all: 'alle Beziehungen',
            outgoing: 'ausgehende Beziehungen',
            incoming: 'eingehende Beziehungen',
            specific: `Beziehungen vom Typ "${specificRelationshipType}"`
        };

        return `Zähle ${modeLabels[countMode]} von "${selectedEntity}" (${selectedEntityType})`;
    };

    return (
        <div className="space-y-6">
            <div className="bg-white rounded-lg border p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center">
                    📊 Beziehungen zählen
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Entity Selection */}
                    <div className="space-y-4">
                        <h4 className="font-medium text-blue-700 flex items-center">
                            🎯 Entity auswählen
                        </h4>

                        <div>
                            <label className="block text-sm font-medium mb-2">Entity-Typ</label>
                            <select
                                value={selectedEntityType}
                                onChange={(e) => {
                                    setSelectedEntityType(e.target.value);
                                    setSelectedEntity('');
                                    setSpecificRelationshipType('');
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
                            <label className="block text-sm font-medium mb-2">Spezifische Entity</label>
                            <EntityDropdown
                                value={selectedEntity}
                                onChange={setSelectedEntity}
                                entityType={selectedEntityType}
                                placeholder={`${selectedEntityType} auswählen...`}
                            />
                        </div>
                    </div>

                    {/* Count Mode Selection */}
                    <div className="space-y-4">
                        <h4 className="font-medium text-green-700 flex items-center">
                            📊 Zähl-Modus
                        </h4>

                        <div className="space-y-3">
                            {countModes.map(mode => (
                                <div key={mode.id} className="flex items-start">
                                    <input
                                        type="radio"
                                        id={mode.id}
                                        name="countMode"
                                        value={mode.id}
                                        checked={countMode === mode.id}
                                        onChange={(e) => {
                                            setCountMode(e.target.value);
                                            setQueryResults(null);
                                            setQueryError(null);
                                        }}
                                        className="mt-1 mr-3"
                                    />
                                    <div>
                                        <label htmlFor={mode.id} className="font-medium text-sm cursor-pointer">
                                            {mode.label}
                                        </label>
                                        <div className="text-xs text-gray-500">{mode.desc}</div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Specific Relationship Type Selection */}
                        {countMode === 'specific' && (
                            <div className="mt-4">
                                <label className="block text-sm font-medium mb-2">Spezifischer Beziehungstyp</label>
                                <select
                                    value={specificRelationshipType}
                                    onChange={(e) => {
                                        setSpecificRelationshipType(e.target.value);
                                        setQueryResults(null);
                                        setQueryError(null);
                                    }}
                                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-green-500"
                                    disabled={!selectedEntityType}
                                >
                                    <option value="">Beziehungstyp wählen...</option>
                                    {relationships[selectedEntityType]?.map(rel => (
                                        <option key={rel.id} value={rel.id}>{rel.label}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>
                </div>

                {/* Query Summary */}
                {selectedEntity && (
                    <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                        <h4 className="font-medium text-gray-700 mb-2">📝 Query-Zusammenfassung:</h4>
                        <p className="text-gray-800">{generateSummaryText()}</p>
                    </div>
                )}

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
                                : 'bg-orange-600 text-white hover:bg-orange-700'
                        }`}
                    >
                        {queryLoading ? (
                            <>
                                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                                Beziehungen werden gezählt...
                            </>
                        ) : (
                            <>
                                <TrendingUp size={16} />
                                Beziehungen zählen
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Results */}
            <QueryResults
                results={queryResults}
                error={queryError}
                queryType="count_relations"
            />
        </div>
    );
};

export default RelationshipCounter;