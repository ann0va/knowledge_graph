// src/components/query/NodeCreator.js - CREATE Node Interface (GERMAN)
import React, { useState, useEffect } from 'react';
import { Plus, Save, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';
import apiService from '../../services/api';
import {
    getEntityTypeLabel,
    getFieldLabel,
} from './shared/LabelTranslator';
const NodeCreator = () => {
    const [entityType, setEntityType] = useState('person');
    const [database, setDatabase] = useState('both'); // 🔧 FIXED: Default to both
    const [nodeData, setNodeData] = useState({});
    const [entityConfigs, setEntityConfigs] = useState({});
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState('');
    const [validationError, setValidationError] = useState('');

    // Entity-Konfigurationen laden
    useEffect(() => {
        const loadConfigs = async () => {
            try {
                const configs = await apiService.getEntityConfigurations();
                setEntityConfigs(configs.entityConfigs || {});
            } catch (err) {
                console.error('Failed to load entity configs:', err);
            }
        };
        loadConfigs();
    }, []);

    // Entity Type geändert - Form zurücksetzen
    useEffect(() => {
        setNodeData({});
        setValidationError('');
        setError('');
        setResult(null);
    }, [entityType]);

    // Aktueller Entity Config
    const currentConfig = entityConfigs[entityType] || {};
    const requiredFields = currentConfig.required_fields || [];
    const optionalFields = currentConfig.optional_fields || [];
    const allFields = [...requiredFields, ...optionalFields];

    

    // Input-Änderung
    const handleInputChange = (field, value) => {
        setNodeData(prev => ({
            ...prev,
            [field]: value
        }));
        // Clear validation errors when user types
        if (validationError) {
            setValidationError('');
        }
    };

    // Wikidata ID generieren
    const generateId = () => {
        const newId = apiService.generateWikidataId();
        handleInputChange('id', newId);
    };

    // Validation
    const validateForm = () => {
        const validationError = apiService.validateNodeData(entityType, nodeData, entityConfigs);
        if (validationError) {
            setValidationError(validationError);
            return false;
        }
        return true;
    };

    // 🆕 MULTI-DATABASE: Node in beiden Datenbanken erstellen
    const createNodeInBothDatabases = async (finalNodeData) => {
        const results = {
            memgraph: null,
            oracle: null,
            success: false,
            errors: []
        };

        // Memgraph
        try {
            console.log('🔵 Creating node in Memgraph...');
            const memgraphResult = await apiService.createNode(entityType, finalNodeData, 'memgraph');
            results.memgraph = memgraphResult;
            console.log('✅ Memgraph node created:', memgraphResult);
        } catch (memgraphError) {
            console.error('❌ Memgraph node creation failed:', memgraphError);
            results.errors.push({
                database: 'memgraph',
                error: memgraphError.message
            });
        }

        // Oracle
        try {
            console.log('🔴 Creating node in Oracle...');
            const oracleResult = await apiService.createNode(entityType, finalNodeData, 'oracle');
            results.oracle = oracleResult;
            console.log('✅ Oracle node created:', oracleResult);
        } catch (oracleError) {
            console.error('❌ Oracle node creation failed:', oracleError);
            results.errors.push({
                database: 'oracle',
                error: oracleError.message
            });
        }

        // Erfolg wenn mindestens eine Datenbank erfolgreich war
        results.success = results.memgraph || results.oracle;

        return results;
    };

    // Node erstellen
    const createNode = async () => {
        if (!validateForm()) return;

        setLoading(true);
        setError('');
        setResult(null);

        try {
            // ID generieren falls nicht vorhanden
            const finalNodeData = {
                ...nodeData,
                id: nodeData.id || apiService.generateWikidataId()
            };

            console.log('Creating node:', finalNodeData);

            let response;

            if (database === 'both') {
                // 🆕 In beiden Datenbanken erstellen
                response = await createNodeInBothDatabases(finalNodeData);
            } else {
                // Einzelne Datenbank
                response = await apiService.createNode(entityType, finalNodeData, database);
            }

            setResult(response);

            // Form zurücksetzen bei Erfolg
            if ((database === 'both' && response.success) || (database !== 'both' && response.success)) {
                setNodeData({});
            }

        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // Field-spezifische Input-Komponente
    const renderField = (field) => {
        const isRequired = requiredFields.includes(field);
        const value = nodeData[field] || '';

        if (field === 'id') {
            return (
                <div key={field} className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                        {getFieldLabel(field)} {isRequired && <span className="text-red-500">*</span>}
                    </label>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={value}
                            onChange={(e) => handleInputChange(field, e.target.value)}
                            placeholder="Q1234567890"
                            className="flex-1 p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                        <button
                            type="button"
                            onClick={generateId}
                            className="px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                        >
                            <RefreshCw size={16} />
                            Generieren
                        </button>
                    </div>
                    <p className="text-xs text-gray-500">
                        Eindeutige Wikidata-Kennung (Q + 10 Ziffern)
                    </p>
                </div>
            );
        }

        if (field.includes('date')) {
            return (
                <div key={field} className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                        {getFieldLabel(field)} {isRequired && <span className="text-red-500">*</span>}
                    </label>
                    <input
                        type="date"
                        value={value}
                        onChange={(e) => handleInputChange(field, e.target.value)}
                        className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                </div>
            );
        }

        if (field === 'gender') {
            return (
                <div key={field} className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                        {getFieldLabel(field)} {isRequired && <span className="text-red-500">*</span>}
                    </label>
                    <select
                        value={value}
                        onChange={(e) => handleInputChange(field, e.target.value)}
                        className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="">Geschlecht auswählen...</option>
                        <option value="Male">Männlich</option>
                        <option value="Female">Weiblich</option>
                        <option value="Other">Divers</option>
                        <option value="Unknown">Unbekannt</option>
                    </select>
                </div>
            );
        }

        if (field === 'type') {
            const typeOptions = {
                place: [
                    { value: 'City', label: 'Stadt' },
                    { value: 'Country', label: 'Land' },
                    { value: 'Region', label: 'Region' },
                    { value: 'Building', label: 'Gebäude' },
                    { value: 'Location', label: 'Standort' }
                ],
                workplace: [
                    { value: 'University', label: 'Universität' },
                    { value: 'Company', label: 'Unternehmen' },
                    { value: 'Institution', label: 'Institution' },
                    { value: 'Laboratory', label: 'Labor' }
                ],
                work: [
                    { value: 'NotableWork', label: 'Bemerkenswertes Werk' },
                    { value: 'Publication', label: 'Publikation' },
                    { value: 'Patent', label: 'Patent' },
                    { value: 'Software', label: 'Software' },
                    { value: 'Theory', label: 'Theorie' }
                ]
            };

            const options = typeOptions[entityType] || [];

            return (
                <div key={field} className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                        {getFieldLabel(field)} {isRequired && <span className="text-red-500">*</span>}
                    </label>
                    <select
                        value={value}
                        onChange={(e) => handleInputChange(field, e.target.value)}
                        className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="">Typ auswählen...</option>
                        {options.map(option => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                </div>
            );
        }

        // Standard Text/Textarea
        const isLongText = field === 'description';
        const InputComponent = isLongText ? 'textarea' : 'input';

        return (
            <div key={field} className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                    {getFieldLabel(field)} {isRequired && <span className="text-red-500">*</span>}
                </label>
                <InputComponent
                    type={isLongText ? undefined : "text"}
                    value={value}
                    onChange={(e) => handleInputChange(field, e.target.value)}
                    placeholder={`${getFieldLabel(field)} eingeben...`}
                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    rows={isLongText ? 3 : undefined}
                />
                {isLongText && (
                    <p className="text-xs text-gray-500">
                        Kurze Beschreibung oder Zusammenfassung
                    </p>
                )}
            </div>
        );
    };

    return (
        <div className="bg-white rounded-lg border p-6">
            <div className="flex items-center gap-3 mb-6">
                <Plus className="text-green-600" size={24} />
                <div>
                    <h3 className="text-lg font-semibold text-gray-900">Neuen Knoten erstellen</h3>
                    <p className="text-gray-600">Erstelle eine neue Entity in der Knowledge Graph Datenbank</p>
                </div>
            </div>

            {/* Entity Type & Database Selection */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">Entity-Typ</label>
                    <select
                        value={entityType}
                        onChange={(e) => setEntityType(e.target.value)}
                        className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
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
                    <label className="block text-sm font-medium text-gray-700">Ziel-Datenbank</label>
                    <select
                        value={database}
                        onChange={(e) => setDatabase(e.target.value)}
                        className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="both">🔵🔴 Beide Datenbanken</option>
                        <option value="memgraph">🔵 Memgraph (Cypher)</option>
                        <option value="oracle">🔴 Oracle (PGQL)</option>
                    </select>
                    <p className="text-xs text-gray-500">
                        {database === 'both'
                            ? 'Knoten wird in beiden Datenbanken erstellt'
                            : `Knoten wird nur in ${database === 'memgraph' ? 'Memgraph' : 'Oracle'} erstellt`
                        }
                    </p>
                </div>
            </div>

            {/* Form Fields */}
            <div className="space-y-4 mb-6">
                <h4 className="font-medium text-gray-900">Entity-Eigenschaften</h4>

                {allFields.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {allFields.map(field => renderField(field))}
                    </div>
                ) : (
                    <div className="p-4 bg-gray-50 rounded-lg text-gray-600">
                        Lade Entity-Konfiguration...
                    </div>
                )}
            </div>

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
                    onClick={createNode}
                    disabled={loading || allFields.length === 0}
                    className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {loading ? (
                        <>
                            <RefreshCw size={16} className="animate-spin" />
                            Erstelle Knoten...
                        </>
                    ) : (
                        <>
                            <Save size={16} />
                            {getEntityTypeLabel(entityType)} erstellen
                        </>
                    )}
                </button>

                <button
                    onClick={() => {
                        setNodeData({});
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
                                ? '✅ Knoten-Erstellung abgeschlossen!'
                                : '✅ Knoten erfolgreich erstellt!'
                            }
                        </h4>
                    </div>

                    {database === 'both' ? (
                        // Multi-Database Result
                        <div className="space-y-4">
                            <div className="grid grid-cols-3 gap-4 mb-3">
                                <div>
                                    <strong>Wikidata-ID:</strong> {nodeData.id || 'Generiert'}
                                </div>
                                <div>
                                    <strong>Entity-Typ:</strong> {getEntityTypeLabel(entityType)}
                                </div>
                                <div>
                                    <strong>Erfolgsrate:</strong> {(result.memgraph ? 1 : 0) + (result.oracle ? 1 : 0)}/2
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Memgraph Result */}
                                {result.memgraph ? (
                                    <div className="p-3 bg-blue-50 border border-blue-200 rounded">
                                        <h5 className="font-medium text-blue-900 mb-2 flex items-center gap-2">
                                            🔵 Memgraph <span className="text-green-600">✅</span>
                                        </h5>
                                        <div className="text-sm text-blue-800">
                                            <div>Erfolgreich erstellt</div>
                                            <div><strong>Label:</strong> {result.memgraph.data?.label}</div>
                                            {result.memgraph.data?.memgraphId && (
                                                <div><strong>Memgraph-ID:</strong> {result.memgraph.data.memgraphId}</div>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="p-3 bg-red-50 border border-red-200 rounded">
                                        <h5 className="font-medium text-red-900 mb-2 flex items-center gap-2">
                                            🔵 Memgraph <span className="text-red-600">❌</span>
                                        </h5>
                                        <div className="text-sm text-red-800">
                                            Fehlgeschlagen: {result.errors.find(e => e.database === 'memgraph')?.error || 'Unbekannter Fehler'}
                                        </div>
                                    </div>
                                )}

                                {/* Oracle Result */}
                                {result.oracle ? (
                                    <div className="p-3 bg-red-50 border border-red-200 rounded">
                                        <h5 className="font-medium text-red-900 mb-2 flex items-center gap-2">
                                            🔴 Oracle <span className="text-green-600">✅</span>
                                        </h5>
                                        <div className="text-sm text-red-800">
                                            <div>Erfolgreich erstellt</div>
                                            <div><strong>Tabelle:</strong> {result.oracle.data?.table}</div>
                                            {result.oracle.data?.rowsAffected && (
                                                <div><strong>Zeilen:</strong> {result.oracle.data.rowsAffected}</div>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="p-3 bg-red-50 border border-red-200 rounded">
                                        <h5 className="font-medium text-red-900 mb-2 flex items-center gap-2">
                                            🔴 Oracle <span className="text-red-600">❌</span>
                                        </h5>
                                        <div className="text-sm text-red-800">
                                            Fehlgeschlagen: {result.errors.find(e => e.database === 'oracle')?.error || 'Unbekannter Fehler'}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {result.errors && result.errors.length > 0 && (
                                <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs">
                                    <strong>Fehlerdetails:</strong>
                                    <ul className="mt-1 space-y-1">
                                        {result.errors.map((error, idx) => (
                                            <li key={idx} className="text-red-600">
                                                • {error.database}: {error.error}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    ) : (
                        // Single Database Result
                        <div className="space-y-2 text-sm">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <strong>Wikidata-ID:</strong> {result.data?.wikidataId}
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
                                    <strong>Entity-Typ:</strong> {getEntityTypeLabel(entityType)}
                                </div>
                                <div>
                                    <strong>Erstellt:</strong> {new Date(result.metadata?.timestamp).toLocaleString()}
                                </div>
                            </div>

                            {result.data?.node && (
                                <div className="mt-3 p-3 bg-white border rounded text-xs">
                                    <strong>Erstellter Knoten:</strong>
                                    <pre className="mt-1 overflow-x-auto">
                                        {JSON.stringify(result.data.node, null, 2)}
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
                    <li>• <strong>Pflichtfelder</strong> sind mit einem roten Sternchen (*) markiert</li>
                    <li>• <strong>Wikidata-ID</strong> wird automatisch generiert, falls nicht angegeben</li>
                    <li>• <strong>Beide Datenbanken:</strong> Knoten wird parallel in Oracle und Memgraph erstellt</li>
                    <li>• <strong>Oracle</strong> fügt in Basistabellen ein, <strong>Memgraph</strong> erstellt Knoten direkt</li>
                    <li>• Alle Daten sollten im Format JJJJ-MM-TT eingegeben werden</li>
                    <li>• Namen sollten innerhalb eines Entity-Typs eindeutig sein</li>
                </ul>
            </div>
        </div>
    );
};

export default NodeCreator;