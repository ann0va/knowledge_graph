// src/components/query/EdgeCreator.js - FIXED: German + Multi-Database Support
import React, { useState, useEffect } from 'react';
import { Link, Save, RefreshCw, CheckCircle, AlertCircle, ArrowRight } from 'lucide-react';
import apiService from '../../services/api';
import EntityDropdown from './shared/EntityDropdown';

const EdgeCreator = () => {
    const [database, setDatabase] = useState('both'); // 🔧 FIXED: Default to both
    const [relationshipType, setRelationshipType] = useState('WORKS_IN');
    const [sourceEntityType, setSourceEntityType] = useState('person');
    const [sourceEntityName, setSourceEntityName] = useState('');
    const [targetEntityType, setTargetEntityType] = useState('field');
    const [targetEntityName, setTargetEntityName] = useState('');
    const [edgeProperties, setEdgeProperties] = useState({});

    const [entityConfigs, setEntityConfigs] = useState({});
    const [edgeConfigs, setEdgeConfigs] = useState({});
    const [availableEdgeTypes, setAvailableEdgeTypes] = useState([]);

    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState('');
    const [validationError, setValidationError] = useState('');

    // Konfigurationen laden
    useEffect(() => {
        const loadConfigs = async () => {
            try {
                const configs = await apiService.getEntityConfigurations();
                setEntityConfigs(configs.entityConfigs || {});
                setEdgeConfigs(configs.edgeConfigs || {});
                setAvailableEdgeTypes(configs.edgeTypes || []);
            } catch (err) {
                console.error('Failed to load configs:', err);
            }
        };
        loadConfigs();
    }, []);

    // Relationship Type geändert - passende Entity Types setzen
    useEffect(() => {
        if (edgeConfigs[relationshipType]) {
            const config = edgeConfigs[relationshipType];
            setSourceEntityType(config.source_type);
            setTargetEntityType(config.target_type);
            setEdgeProperties({});
        }
        setValidationError('');
        setError('');
        setResult(null);
    }, [relationshipType, edgeConfigs]);

    // Aktuelle Edge-Konfiguration
    const currentEdgeConfig = edgeConfigs[relationshipType] || {};
    const availableProperties = currentEdgeConfig.properties || [];

    // 🔧 GERMAN LABELS: Relationship Type Labels
    const getRelationshipTypeLabel = (type) => {
        const labels = {
            'WORKS_IN': 'arbeitet in Bereich',
            'HAS_OCCUPATION': 'hat Beruf',
            'RECEIVED': 'erhielt Auszeichnung',
            'BIRTH_IN': 'wurde geboren in',
            'DIED_IN': 'starb in',
            'WORKED_AT': 'arbeitete bei',
            'CREATED': 'erschuf Werk',
            'STUDENT_OF': 'war Student von',
            'ADVISED': 'betreute',
            'PARTNER_OF': 'war Partner von',
            'RELATIVE_OF': 'ist verwandt mit',
            'INFLUENCED_BY': 'wurde beeinflusst von',
            'SIGNIFICANT_PERSON_FOR': 'war bedeutsam für',
            'FATHER_OF': 'ist Vater von',
            'MOTHER_OF': 'ist Mutter von',
            'NATIONAL_OF': 'ist Staatsangehöriger von'
        };
        return labels[type] || type;
    };

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

    // Property-Änderung
    const handlePropertyChange = (property, value) => {
        setEdgeProperties(prev => ({
            ...prev,
            [property]: value
        }));
    };

    // Source Entity ID aus Name ermitteln - MIT DEBUGGING
    const getEntityIdByName = async (entityType, entityName, db) => {
        try {
            console.log(`🔍 Looking up entity: ${entityType}:${entityName} in ${db}`);

            const searchResult = await apiService.searchEntityNames(entityType, entityName, db, 10);
            console.log(`🔍 Search result for ${entityName}:`, searchResult);

            if (searchResult.success && searchResult.data.results.length > 0) {
                // Suche nach exakter Übereinstimmung
                const exactMatch = searchResult.data.results.find(entity => {
                    const entityName_from_result = db === 'oracle'
                        ? (entity.NAME || entity.name)
                        : (entity['e.name'] || entity.name);
                    return entityName_from_result === entityName;
                });

                const entity = exactMatch || searchResult.data.results[0];
                console.log(`🔍 Selected entity for ${entityName}:`, entity);

                // Wikidata ID extrahieren
                let wikidataId;
                if (db === 'oracle') {
                    wikidataId = entity.id || entity.ID;
                    // Extract from VERTEX_ID if needed
                    if (!wikidataId && entity.VERTEX_ID) {
                        const match = entity.VERTEX_ID.match(/\(([^)]+)\)/);
                        wikidataId = match ? match[1] : entity.VERTEX_ID;
                    }
                } else {
                    wikidataId = entity['e.id'] || entity.id;
                }

                console.log(`🔍 Extracted Wikidata ID for ${entityName}: ${wikidataId}`);
                return wikidataId;
            }

            console.warn(`⚠️ No results found for ${entityType}:${entityName} in ${db}`);
            return null;
        } catch (err) {
            console.error(`❌ Failed to get entity ID for ${entityName}:`, err);
            return null;
        }
    };

    // Validation
    const validateForm = () => {
        if (!relationshipType) {
            setValidationError('Beziehungstyp ist erforderlich');
            return false;
        }

        if (!sourceEntityName.trim()) {
            setValidationError('Start-Entity-Name ist erforderlich');
            return false;
        }

        if (!targetEntityName.trim()) {
            setValidationError('Ziel-Entity-Name ist erforderlich');
            return false;
        }

        if (sourceEntityName.trim() === targetEntityName.trim() && sourceEntityType === targetEntityType) {
            setValidationError('Start- und Ziel-Entities müssen unterschiedlich sein');
            return false;
        }

        setValidationError('');
        return true;
    };

    // 🆕 MULTI-DATABASE: Edge in beiden Datenbanken erstellen
    const createEdgeInBothDatabases = async (edgeData) => {
        const results = {
            memgraph: null,
            oracle: null,
            success: false,
            errors: []
        };

        // Memgraph
        try {
            console.log('🔵 Creating edge in Memgraph...');
            const memgraphResult = await apiService.createEdge(edgeData, 'memgraph');
            results.memgraph = memgraphResult;
            console.log('✅ Memgraph edge created:', memgraphResult);
        } catch (memgraphError) {
            console.error('❌ Memgraph edge creation failed:', memgraphError);
            results.errors.push({
                database: 'memgraph',
                error: memgraphError.message
            });
        }

        // Oracle
        try {
            console.log('🔴 Creating edge in Oracle...');
            const oracleResult = await apiService.createEdge(edgeData, 'oracle');
            results.oracle = oracleResult;
            console.log('✅ Oracle edge created:', oracleResult);
        } catch (oracleError) {
            console.error('❌ Oracle edge creation failed:', oracleError);
            results.errors.push({
                database: 'oracle',
                error: oracleError.message
            });
        }

        // Erfolg wenn mindestens eine Datenbank erfolgreich war
        results.success = results.memgraph || results.oracle;

        return results;
    };

    // Edge erstellen
    const createEdge = async () => {
        if (!validateForm()) return;

        setLoading(true);
        setError('');
        setResult(null);

        try {
            console.log('🔍 Starting edge creation process...');

            // Determine which databases to use for ID lookup
            const databasesToCheck = database === 'both' ? ['memgraph', 'oracle'] : [database];

            let sourceId = null;
            let targetId = null;

            // Find source entity ID in available databases
            for (const db of databasesToCheck) {
                if (!sourceId) {
                    sourceId = await getEntityIdByName(sourceEntityType, sourceEntityName, db);
                    if (sourceId) {
                        console.log(`✅ Found source entity ${sourceEntityName} in ${db}: ${sourceId}`);
                    }
                }
            }

            // Find target entity ID in available databases
            for (const db of databasesToCheck) {
                if (!targetId) {
                    targetId = await getEntityIdByName(targetEntityType, targetEntityName, db);
                    if (targetId) {
                        console.log(`✅ Found target entity ${targetEntityName} in ${db}: ${targetId}`);
                    }
                }
            }

            if (!sourceId) {
                throw new Error(`❌ Start-Entity "${sourceEntityName}" (${getEntityTypeLabel(sourceEntityType)}) nicht gefunden. Stellen Sie sicher, dass die Entity existiert und der Name korrekt geschrieben ist.`);
            }

            if (!targetId) {
                throw new Error(`❌ Ziel-Entity "${targetEntityName}" (${getEntityTypeLabel(targetEntityType)}) nicht gefunden. Stellen Sie sicher, dass die Entity existiert und der Name korrekt geschrieben ist.`);
            }

            // Edge Data zusammenstellen
            const edgeData = {
                relationshipType,
                sourceEntityType,
                sourceId,
                targetEntityType,
                targetId,
                properties: edgeProperties
            };

            console.log('🔧 Final edge data:', edgeData);

            let response;

            if (database === 'both') {
                // 🆕 In beiden Datenbanken erstellen
                response = await createEdgeInBothDatabases(edgeData);
            } else {
                // Einzelne Datenbank
                response = await apiService.createEdge(edgeData, database);
            }

            setResult(response);

            // Form teilweise zurücksetzen
            setSourceEntityName('');
            setTargetEntityName('');
            setEdgeProperties({});

        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // Property-spezifische Input-Komponente
    const renderPropertyField = (property) => {
        const value = edgeProperties[property] || '';

        // 🔧 GERMAN LABELS für Properties
        const getPropertyLabel = (prop) => {
            const labels = {
                'start_date': 'Startdatum',
                'end_date': 'Enddatum',
                'date': 'Datum',
                'description': 'Beschreibung',
                'type': 'Typ',
                'role': 'Rolle'
            };
            return labels[prop] || prop.replace('_', ' ').toUpperCase();
        };

        if (property.includes('date')) {
            return (
                <div key={property} className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                        {getPropertyLabel(property)}
                    </label>
                    <input
                        type="date"
                        value={value}
                        onChange={(e) => handlePropertyChange(property, e.target.value)}
                        className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                </div>
            );
        }

        return (
            <div key={property} className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                    {getPropertyLabel(property)}
                </label>
                <input
                    type="text"
                    value={value}
                    onChange={(e) => handlePropertyChange(property, e.target.value)}
                    placeholder={`${getPropertyLabel(property)} eingeben...`}
                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
            </div>
        );
    };

    return (
        <div className="bg-white rounded-lg border p-6">
            <div className="flex items-center gap-3 mb-6">
                <Link className="text-blue-600" size={24} />
                <div>
                    <h3 className="text-lg font-semibold text-gray-900">Neue Beziehung erstellen</h3>
                    <p className="text-gray-600">Verbinde zwei existierende Entities mit einer Beziehung</p>
                </div>
            </div>

            {/* Database Selection */}
            <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Ziel-Datenbank</label>
                <select
                    value={database}
                    onChange={(e) => setDatabase(e.target.value)}
                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 max-w-md"
                >
                    <option value="both">🔵🔴 Beide Datenbanken</option>
                    <option value="memgraph">🔵 Memgraph (Cypher)</option>
                    <option value="oracle">🔴 Oracle (PGQL)</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                    {database === 'both'
                        ? 'Beziehung wird in beiden Datenbanken erstellt (wenn Entities existieren)'
                        : `Beziehung wird nur in ${database === 'memgraph' ? 'Memgraph' : 'Oracle'} erstellt`
                    }
                </p>
            </div>

            {/* Relationship Type Selection */}
            <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Beziehungstyp</label>
                <select
                    value={relationshipType}
                    onChange={(e) => setRelationshipType(e.target.value)}
                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                    {availableEdgeTypes.map(edgeType => (
                        <option key={edgeType} value={edgeType}>
                            {getRelationshipTypeLabel(edgeType)}
                            {edgeConfigs[edgeType] && (
                                ` (${getEntityTypeLabel(edgeConfigs[edgeType].source_type)} → ${getEntityTypeLabel(edgeConfigs[edgeType].target_type)})`
                            )}
                        </option>
                    ))}
                </select>

                {currentEdgeConfig.source_type && (
                    <p className="text-sm text-gray-500 mt-1">
                        🔗 Verbindet: <strong>{getEntityTypeLabel(currentEdgeConfig.source_type)}</strong> → <strong>{getEntityTypeLabel(currentEdgeConfig.target_type)}</strong>
                    </p>
                )}
            </div>

            {/* Source and Target Entity Selection */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                {/* Source Entity */}
                <div className="space-y-4">
                    <h4 className="font-medium text-gray-900 flex items-center gap-2">
                        🚀 Start-Entity
                    </h4>

                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">Entity-Typ</label>
                        <select
                            value={sourceEntityType}
                            onChange={(e) => setSourceEntityType(e.target.value)}
                            disabled={currentEdgeConfig.source_type}
                            className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                        >
                            <option value="person">👤 Person</option>
                            <option value="place">📍 Ort</option>
                            <option value="work">📚 Werk</option>
                            <option value="award">🏆 Auszeichnung</option>
                            <option value="field">🔬 Fachbereich</option>
                            <option value="occupation">💼 Beruf</option>
                            <option value="workplace">🏢 Arbeitsplatz</option>
                        </select>
                    </div>

                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">Entity-Name</label>
                        <EntityDropdown
                            value={sourceEntityName}
                            onChange={setSourceEntityName}
                            entityType={sourceEntityType}
                            database="both"
                            showDatabaseIndicator={true}
                            placeholder={`${getEntityTypeLabel(sourceEntityType)} auswählen...`}
                        />
                    </div>
                </div>

                {/* Arrow */}
                <div className="flex items-center justify-center lg:pt-16">
                    <div className="flex flex-col items-center gap-2 text-blue-600">
                        <ArrowRight size={24} />
                        <span className="text-xs font-medium text-center">{getRelationshipTypeLabel(relationshipType)}</span>
                    </div>
                </div>

                {/* Target Entity */}
                <div className="space-y-4">
                    <h4 className="font-medium text-gray-900 flex items-center gap-2">
                        🎯 Ziel-Entity
                    </h4>

                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">Entity-Typ</label>
                        <select
                            value={targetEntityType}
                            onChange={(e) => setTargetEntityType(e.target.value)}
                            disabled={currentEdgeConfig.target_type}
                            className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                        >
                            <option value="person">👤 Person</option>
                            <option value="place">📍 Ort</option>
                            <option value="work">📚 Werk</option>
                            <option value="award">🏆 Auszeichnung</option>
                            <option value="field">🔬 Fachbereich</option>
                            <option value="occupation">💼 Beruf</option>
                            <option value="workplace">🏢 Arbeitsplatz</option>
                        </select>
                    </div>

                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">Entity-Name</label>
                        <EntityDropdown
                            value={targetEntityName}
                            onChange={setTargetEntityName}
                            entityType={targetEntityType}
                            database="both"
                            showDatabaseIndicator={true}
                            placeholder={`${getEntityTypeLabel(targetEntityType)} auswählen...`}
                        />
                    </div>
                </div>
            </div>

            {/* Edge Properties */}
            {availableProperties.length > 0 && (
                <div className="mb-6">
                    <h4 className="font-medium text-gray-900 mb-4">Beziehungseigenschaften (Optional)</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {availableProperties.map(property => renderPropertyField(property))}
                    </div>
                </div>
            )}

            {/* Validation Error */}
            {validationError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-center gap-2">
                    <AlertCircle size={16} />
                    {validationError}
                </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 mb-6">
                <button
                    onClick={createEdge}
                    disabled={loading || !sourceEntityName || !targetEntityName}
                    className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {loading ? (
                        <>
                            <RefreshCw size={16} className="animate-spin" />
                            Erstelle Beziehung...
                        </>
                    ) : (
                        <>
                            <Save size={16} />
                            Beziehung erstellen
                        </>
                    )}
                </button>

                <button
                    onClick={() => {
                        setSourceEntityName('');
                        setTargetEntityName('');
                        setEdgeProperties({});
                        setValidationError('');
                        setError('');
                        setResult(null);
                    }}
                    className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                    Formular zurücksetzen
                </button>
            </div>

            {/* Success Result - MULTI-DATABASE SUPPORT */}
            {result && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center gap-2 mb-3">
                        <CheckCircle className="text-green-600" size={20} />
                        <h4 className="font-medium text-green-900">
                            {database === 'both'
                                ? '✅ Beziehungen-Erstellung abgeschlossen!'
                                : '✅ Beziehung erfolgreich erstellt!'
                            }
                        </h4>
                    </div>

                    {database === 'both' ? (
                        // Multi-Database Result
                        <div className="space-y-4">
                            {/* Memgraph Result */}
                            {result.memgraph ? (
                                <div className="p-3 bg-blue-50 border border-blue-200 rounded">
                                    <h5 className="font-medium text-blue-900 mb-2">🔵 Memgraph</h5>
                                    <div className="text-sm text-blue-800">
                                        <div>✅ Erfolgreich erstellt</div>
                                        <div><strong>Beziehung:</strong> {result.memgraph.data?.edge?.relationshipType}</div>
                                        <div><strong>Von:</strong> {result.memgraph.data?.edge?.sourceId}</div>
                                        <div><strong>Nach:</strong> {result.memgraph.data?.edge?.targetId}</div>
                                    </div>
                                </div>
                            ) : (
                                <div className="p-3 bg-red-50 border border-red-200 rounded">
                                    <h5 className="font-medium text-red-900 mb-2">🔵 Memgraph</h5>
                                    <div className="text-sm text-red-800">
                                        ❌ Fehlgeschlagen: {result.errors.find(e => e.database === 'memgraph')?.error || 'Unbekannter Fehler'}
                                    </div>
                                </div>
                            )}

                            {/* Oracle Result */}
                            {result.oracle ? (
                                <div className="p-3 bg-red-50 border border-red-200 rounded">
                                    <h5 className="font-medium text-red-900 mb-2">🔴 Oracle</h5>
                                    <div className="text-sm text-red-800">
                                        <div>✅ Erfolgreich erstellt</div>
                                        <div><strong>Beziehung:</strong> {result.oracle.data?.edge?.relationshipType}</div>
                                        <div><strong>Von:</strong> {result.oracle.data?.edge?.sourceId}</div>
                                        <div><strong>Nach:</strong> {result.oracle.data?.edge?.targetId}</div>
                                    </div>
                                </div>
                            ) : (
                                <div className="p-3 bg-red-50 border border-red-200 rounded">
                                    <h5 className="font-medium text-red-900 mb-2">🔴 Oracle</h5>
                                    <div className="text-sm text-red-800">
                                        ❌ Fehlgeschlagen: {result.errors.find(e => e.database === 'oracle')?.error || 'Unbekannter Fehler'}
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        // Single Database Result
                        <div className="space-y-2 text-sm">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <strong>Beziehung:</strong> {getRelationshipTypeLabel(result.data?.edge?.relationshipType)}
                                </div>
                                <div>
                                    <strong>Datenbank:</strong>
                                    <span className={`ml-2 px-2 py-1 text-xs rounded ${
                                        result.data?.database === 'memgraph'
                                            ? 'bg-blue-100 text-blue-800'
                                            : 'bg-red-100 text-red-800'
                                    }`}>
                                        {result.data?.database === 'memgraph' ? '🔵 Memgraph' : '🔴 Oracle'}
                                    </span>
                                </div>
                                <div>
                                    <strong>Von:</strong> {result.data?.edge?.sourceId}
                                </div>
                                <div>
                                    <strong>Nach:</strong> {result.data?.edge?.targetId}
                                </div>
                            </div>

                            {result.data?.edge && (
                                <div className="mt-3 p-3 bg-white border rounded text-xs">
                                    <strong>Erstellte Beziehung:</strong>
                                    <pre className="mt-1 overflow-x-auto">
                                        {JSON.stringify(result.data.edge, null, 2)}
                                    </pre>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Error Display */}
            {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                        <AlertCircle className="text-red-600" size={20} />
                        <h4 className="font-medium text-red-900">❌ Erstellung fehlgeschlagen</h4>
                    </div>
                    <p className="text-red-700 text-sm">{error}</p>
                </div>
            )}

            {/* Info Box */}
            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm">
                <h5 className="font-medium text-blue-900 mb-2">💡 Nutzungshinweise:</h5>
                <ul className="text-blue-800 space-y-1">
                    <li>• Wählen Sie zuerst einen <strong>Beziehungstyp</strong> aus, um Entity-Typen automatisch zu konfigurieren</li>
                    <li>• Entity-Namen müssen in der gewählten Datenbank existieren</li>
                    <li>• <strong>Beide Datenbanken:</strong> Beziehung wird in beiden erstellt (wenn Entities vorhanden)</li>
                    <li>• <strong>Oracle</strong> erstellt Beziehungen über Basistabellen, <strong>Memgraph</strong> über Cypher</li>
                    <li>• Eigenschaften wie Daten sind optional und beziehungsspezifisch</li>
                    <li>• Verschiedene Beziehungstypen verbinden verschiedene Entity-Typen</li>
                </ul>
            </div>
        </div>
    );
};

export default EdgeCreator;