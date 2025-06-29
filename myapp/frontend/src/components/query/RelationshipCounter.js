// src/components/query/RelationshipCounter.js - Count Entity Relationships
import React, { useState } from 'react';
import { BarChart3, TrendingUp, Database } from 'lucide-react';
import EntityDropdown from './shared/EntityDropdown';
import QueryResults from './shared/QueryResults';
import { QueryInterface } from './shared/QueryInterface';

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
            { id: 'WORKS_IN', label: 'arbeitet in Bereich' },
            { id: 'HAS_OCCUPATION', label: 'hat Beruf' },
            { id: 'RECEIVED', label: 'erhielt Auszeichnung' },
            { id: 'BIRTH_IN', label: 'wurde geboren in' },
            { id: 'DIED_IN', label: 'starb in' },
            { id: 'WORKED_AT', label: 'arbeitete bei' },
            { id: 'CREATED', label: 'erschuf Werk' },
            { id: 'STUDENT_OF', label: 'war Student von' },
            { id: 'ADVISED', label: 'betreute' },
            { id: 'PARTNER_OF', label: 'war Partner von' },
            { id: 'RELATIVE_OF', label: 'ist verwandt mit' },
            { id: 'INFLUENCED_BY', label: 'wurde beeinflusst von' },
            { id: 'SIGNIFICANT_PERSON_FOR', label: 'war bedeutsam für' },
            { id: 'FATHER_OF', label: 'ist Vater von' },
            { id: 'MOTHER_OF', label: 'ist Mutter von' },
            { id: 'NATIONAL_OF', label: 'ist Staatsangehöriger von' }
        ],
        award: [
            { id: 'AWARDED_TO', label: 'wurde verliehen an' },
            { id: 'IN_FIELD', label: 'ist im Bereich' }
        ],
        field: [
            { id: 'WORKED_BY', label: 'wird bearbeitet von' }
        ],
        place: [
            { id: 'BIRTH_PLACE_OF', label: 'ist Geburtsort von' },
            { id: 'DEATH_PLACE_OF', label: 'ist Sterbeort von' },
            { id: 'WORKPLACE_IN', label: 'hat Arbeitsplätze' }
        ],
        work: [
            { id: 'CREATED_BY', label: 'wurde erschaffen von' }
        ],
        workplace: [
            { id: 'EMPLOYED', label: 'beschäftigte' }
        ],
        occupation: [
            { id: 'HELD_BY', label: 'wird ausgeübt von' }
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

    const executeQuery = async () => {
        if (!validateQuery()) return;

        setQueryLoading(true);
        setQueryError(null);
        setQueryResults(null);

        try {
            // Erstelle eine spezielle Query für Relationship Counting
            const queryData = {
                queryType: 'count_relations',
                entityType: selectedEntityType,
                entityName: selectedEntity,
                countMode: countMode,
                relationshipType: countMode === 'specific' ? specificRelationshipType : null,
                database: 'both'
            };

            console.log('🔢 Executing relationship count query:', queryData);

            // Da count_relations noch nicht im Backend implementiert ist, 
            // simulieren wir es mit find_related und zählen die Ergebnisse
            const simulatedQueryData = {
                queryType: 'find_related',
                entityType: selectedEntityType,
                entityName: selectedEntity,
                relationshipType: countMode === 'specific' ? specificRelationshipType : null,
                database: 'both'
            };

            const result = await queryInterface.executeQuery(simulatedQueryData);

            if (result.success) {
                // Transformiere die Ergebnisse zu Count-Format
                const transformedResult = transformToCountResult(result.data, countMode);
                setQueryResults(transformedResult);
            } else {
                setQueryError(result.error);
            }
        } catch (error) {
            console.error('❌ Relationship count error:', error);
            setQueryError(error.message);
        } finally {
            setQueryLoading(false);
        }
    };

    // Transformiere find_related Ergebnisse zu Count-Format
    const transformToCountResult = (originalResult, mode) => {
        const countResult = {
            ...originalResult,
            queryType: 'count_relations',
            countMode: mode,
            results: {}
        };

        // Oracle Results
        if (originalResult.results?.oracle) {
            const oracleRels = originalResult.results.oracle.relationships || [];
            countResult.results.oracle = {
                ...originalResult.results.oracle,
                totalCount: oracleRels.length,
                relationshipCounts: getRelationshipTypeCounts(oracleRels, 'oracle'),
                summary: `${oracleRels.length} Beziehungen gefunden`
            };
        }

        // Memgraph Results
        if (originalResult.results?.memgraph) {
            const memgraphRels = originalResult.results.memgraph.relationships || [];
            countResult.results.memgraph = {
                ...originalResult.results.memgraph,
                totalCount: memgraphRels.length,
                relationshipCounts: getRelationshipTypeCounts(memgraphRels, 'memgraph'),
                summary: `${memgraphRels.length} Beziehungen gefunden`
            };
        }

        return countResult;
    };

    // Zähle Beziehungstypen
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
                    <BarChart3 size={20} className="mr-2" />
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