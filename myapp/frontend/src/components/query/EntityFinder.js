// src/components/query/EntityFinder.js - COMPLETE VERSION with conditional logic

import React, {useState} from 'react';
import {User, Search} from 'lucide-react';
import EntityDropdown from './shared/EntityDropdown';
import QueryResults from './shared/QueryResults';
import {QueryInterface} from './shared/QueryInterface';
import {
    getEntityTypeLabel,
} from './shared/LabelTranslator';

const EntityFinder = () => {
    const [selectedEntity, setSelectedEntity] = useState('');
    const [selectedEntityType, setSelectedEntityType] = useState('person');
    const [relationshipType, setRelationshipType] = useState('');
    const [queryResults, setQueryResults] = useState(null);
    const [queryLoading, setQueryLoading] = useState(false);
    const [queryError, setQueryError] = useState(null);
    const [validationError, setValidationError] = useState('');

    const queryInterface = new QueryInterface();

    const entityTypes = [
        {id: 'person', label: 'Person', icon: User},
        {id: 'award', label: 'Auszeichnung'},
        {id: 'field', label: 'Fachbereich'},
        {id: 'place', label: 'Ort'},
        {id: 'work', label: 'Werk'},
        {id: 'workplace', label: 'Arbeitsplatz'},
        {id: 'occupation', label: 'Beruf'}
    ];
    

    // ✅ COMPLETE RELATIONSHIPS - nur für Personen relevant
    const relationships = {
        person: [
            {id: 'WORKS_IN', label: 'arbeitet in Bereich', target: 'field'},
            {id: 'HAS_OCCUPATION', label: 'hat Beruf', target: 'occupation'},
            {id: 'RECEIVED', label: 'erhielt Auszeichnung', target: 'award'},
            {id: 'BIRTH_IN', label: 'wurde geboren in', target: 'place'},
            {id: 'DIED_IN', label: 'starb in', target: 'place'},
            {id: 'WORKED_AT', label: 'arbeitete bei', target: 'workplace'},
            {id: 'CREATED', label: 'erschuf Werk', target: 'work'},
            {id: 'STUDENT_OF', label: 'war Student von', target: 'person'},
            {id: 'ADVISED', label: 'betreute', target: 'person'},
            {id: 'PARTNER_OF', label: 'war Partner von', target: 'person'},
            {id: 'RELATIVE_OF', label: 'ist verwandt mit', target: 'person'},
            {id: 'INFLUENCED_BY', label: 'wurde beeinflusst von', target: 'person'},
            {id: 'SIGNIFICANT_PERSON_FOR', label: 'war bedeutsam für', target: 'person'},
            {id: 'FATHER_OF', label: 'ist Vater von', target: 'person'},
            {id: 'MOTHER_OF', label: 'ist Mutter von', target: 'person'},
            {id: 'NATIONAL_OF', label: 'ist Staatsangehöriger von', target: 'place'}
        ]
    };

    // 🆕 NEW: Check if current entity type is person
    const isPersonEntity = selectedEntityType === 'person';

    const validateQuery = () => {
        const entityError = queryInterface.validateNotEmpty(selectedEntity, 'Entity');
        if (entityError) {
            setValidationError(entityError);
            return false;
        }

        // 🆕 NEW: Only validate relationship type for person entities
        if (isPersonEntity) {
            const relationshipError = queryInterface.validateNotEmpty(relationshipType, 'Beziehungstyp');
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

        let queryData;

        if (isPersonEntity) {
            // 🆕 NEW: For person entities, use the existing logic
            queryData = {
                queryType: 'find_related',
                entityType: selectedEntityType,
                entityName: selectedEntity,
                relationshipType,
                targetEntityType: relationships[selectedEntityType]?.find(r => r.id === relationshipType)?.target,
                database: 'both'
            };

            const result = await queryInterface.executeQuery(queryData);

            if (result.success) {
                setQueryResults(result.data);
            } else {
                setQueryError(result.error);
            }
        } else {
            // 🆕 NEW: For non-person entities, use the new findConnectedPersons method
            queryData = {
                queryType: 'find_connected_persons', // New backend method
                entityType: selectedEntityType,
                entityName: selectedEntity,
                database: 'both'
            };

            const result = await queryInterface.executeQuery(queryData);

            if (result.success) {
                // Transform data for consistent display (source_* to target_*)
                let transformedData = result.data;

                if (result.data && result.data.results) {
                    ['oracle', 'memgraph'].forEach(db => {
                        if (transformedData.results[db] && transformedData.results[db].relationships) {
                            console.log(`🔧 Transforming ${db} connected persons:`, transformedData.results[db].relationships);

                            transformedData.results[db].relationships = transformedData.results[db].relationships.map(rel => ({
                                target_name: rel.source_name || rel.SOURCE_NAME,
                                target_entity_id: rel.source_entity_id || rel.SOURCE_ENTITY_ID,
                                target_vertex_id: rel.source_vertex_id || rel.SOURCE_VERTEX_ID,
                                target_labels: rel.source_labels || ['person'],
                                target_properties: rel.source_properties,
                                relationship_type: rel.relationship_type || rel.RELATIONSHIP_TYPE,
                                _from_connected_persons_method: true
                            })).filter(rel => rel.target_name);

                            transformedData.results[db].count = transformedData.results[db].relationships.length;

                            console.log(`✅ Transformed ${db} to ${transformedData.results[db].relationships.length} connected persons`);
                        }
                    });
                }

                setQueryResults(transformedData);
            } else {
                setQueryError(result.error);
            }
        }

        setQueryLoading(false);
    };

    return (
        <div className="space-y-6">
            <div className="bg-white rounded-lg border p-6">
                <h3 className="text-lg font-semibold mb-4">🔍 Verwandte Entitäten finden</h3>

                {/* 🆕 NEW: Dynamic grid - 3 columns for person, 2 for others */}
                <div className={`grid grid-cols-1 gap-6 ${isPersonEntity ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
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

                    {/* Entity Selection */}
                    <div>
                        <label className="block text-sm font-medium mb-2">Spezifische Entity</label>
                        <EntityDropdown
                            value={selectedEntity}
                            onChange={setSelectedEntity}
                            entityType={selectedEntityType}
                            placeholder={`${getEntityTypeLabel(selectedEntityType)} auswählen...`}
                        />
                    </div>

                    {/* 🆕 NEW: Relationship Type - only shown for person entities */}
                    {isPersonEntity && (
                        <div>
                            <label className="block text-sm font-medium mb-2">Beziehungstyp</label>
                            <select
                                value={relationshipType}
                                onChange={(e) => setRelationshipType(e.target.value)}
                                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                disabled={!selectedEntityType}
                            >
                                <option value="">Beziehung wählen...</option>
                                {relationships[selectedEntityType]?.map(rel => (
                                    <option key={rel.id} value={rel.id}>{rel.label}</option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>

                {/* 🆕 NEW: Info text for non-person entities */}
                {!isPersonEntity && (
                    <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <div className="flex items-center">
                            <div className="text-blue-600 mr-2">ℹ️</div>
                            <div className="text-blue-800 text-sm">
                                Für <strong>{getEntityTypeLabel(selectedEntityType)}</strong> werden automatisch verwandte Personen gesucht.
                            </div>
                        </div>
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
                                : 'bg-green-600 text-white hover:bg-green-700'
                        }`}
                    >
                        {queryLoading ? (
                            <>
                                <div
                                    className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                                Query wird ausgeführt...
                            </>
                        ) : (
                            <>
                                <Search size={16}/>
                                {isPersonEntity ? 'Verwandte Entitäten finden' : 'Verwandte Personen finden'}
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Results */}
            <QueryResults
                results={queryResults}
                error={queryError}
                queryType="find_related"
            />

            {/*    /!* Debug - temporär hinzufügen *!/*/}
            {/*    {queryResults && (*/}
            {/*        <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded">*/}
            {/*            <h4 className="font-medium mb-2">🐛 Debug - QueryResults Structure:</h4>*/}
            {/*            <pre className="text-xs overflow-x-auto bg-white p-2 rounded">*/}
            {/*    {JSON.stringify(queryResults, null, 2)}*/}
            {/*</pre>*/}
            {/*        </div>*/}
            {/*    )}*/}

            {/*/!* Graph Visualization - FIXED *!/*/}
            {/*{queryResults && (*/}
            {/*    <div className="mt-6">*/}
            {/*        <GraphResultsVisualizer*/}
            {/*            results={queryResults}*/}
            {/*            title="🔍 Found Entities - Graph View"*/}
            {/*            height="500px"*/}
            {/*        />*/}
            {/*    </div>*/}
            {/*)}*/}
        </div>
    );
};

export default EntityFinder;