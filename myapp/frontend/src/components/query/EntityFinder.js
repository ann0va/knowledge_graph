// src/components/query/EntityFinder.js - COMPLETE VERSION with ALL relationships

import React, { useState } from 'react';
import { User, Search } from 'lucide-react';
import EntityDropdown from './shared/EntityDropdown';
import QueryResults from './shared/QueryResults';
import { QueryInterface } from './shared/QueryInterface';

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
        { id: 'person', label: 'Person', icon: User },
        { id: 'award', label: 'Auszeichnung' },
        { id: 'field', label: 'Fachbereich' },
        { id: 'place', label: 'Ort' },
        { id: 'work', label: 'Werk' },
        { id: 'workplace', label: 'Arbeitsplatz' },
        { id: 'occupation', label: 'Beruf' }
    ];

    // ✅ COMPLETE RELATIONSHIPS - alle 15+ Relationships wie im alten QueryBuilder
    const relationships = {
        person: [
            { id: 'WORKS_IN', label: 'arbeitet in Bereich', target: 'field' },
            { id: 'HAS_OCCUPATION', label: 'hat Beruf', target: 'occupation' },
            { id: 'RECEIVED', label: 'erhielt Auszeichnung', target: 'award' },
            { id: 'BIRTH_IN', label: 'wurde geboren in', target: 'place' },
            { id: 'DIED_IN', label: 'starb in', target: 'place' },
            { id: 'WORKED_AT', label: 'arbeitete bei', target: 'workplace' },
            { id: 'CREATED', label: 'erschuf Werk', target: 'work' },
            { id: 'STUDENT_OF', label: 'war Student von', target: 'person' },
            { id: 'ADVISED', label: 'betreute', target: 'person' },
            { id: 'PARTNER_OF', label: 'war Partner von', target: 'person' },
            { id: 'RELATIVE_OF', label: 'ist verwandt mit', target: 'person' },
            { id: 'INFLUENCED_BY', label: 'wurde beeinflusst von', target: 'person' },
            { id: 'SIGNIFICANT_FOR', label: 'war bedeutsam für', target: 'person' },
            { id: 'FATHER_OF', label: 'ist Vater von', target: 'person' },
            { id: 'MOTHER_OF', label: 'ist Mutter von', target: 'person' },
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

    const validateQuery = () => {
        const entityError = queryInterface.validateNotEmpty(selectedEntity, 'Entity');
        if (entityError) {
            setValidationError(entityError);
            return false;
        }

        const relationshipError = queryInterface.validateNotEmpty(relationshipType, 'Beziehungstyp');
        if (relationshipError) {
            setValidationError(relationshipError);
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

        setQueryLoading(false);
    };

    return (
        <div className="space-y-6">
            <div className="bg-white rounded-lg border p-6">
                <h3 className="text-lg font-semibold mb-4">🔍 Verwandte Entitäten finden</h3>

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

                    {/* Entity Selection */}
                    <div>
                        <label className="block text-sm font-medium mb-2">Spezifische Entity</label>
                        <EntityDropdown
                            value={selectedEntity}
                            onChange={setSelectedEntity}
                            entityType={selectedEntityType}
                            placeholder={`${selectedEntityType} auswählen...`}
                        />
                    </div>

                    {/* Relationship Type */}
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
                                <Search size={16} />
                                Verwandte Entitäten finden
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
        </div>
    );
};

export default EntityFinder;