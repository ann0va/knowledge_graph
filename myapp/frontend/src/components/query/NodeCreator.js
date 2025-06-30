// src/components/query/NodeCreator.js - CREATE Node Interface
import React, { useState, useEffect } from 'react';
import { Plus, Save, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';
import apiService from '../../services/api';

const NodeCreator = () => {
    const [entityType, setEntityType] = useState('person');
    const [database, setDatabase] = useState('memgraph');
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

            if (database === 'both') {
                // 🆕 BEIDE DATENBANKEN
                const results = { oracle: null, memgraph: null };
                const errors = [];

                // Oracle zuerst
                try {
                    console.log('Creating in Oracle...');
                    results.oracle = await apiService.createNode(entityType, finalNodeData, 'oracle');
                } catch (err) {
                    console.error('Oracle creation failed:', err);
                    errors.push(`Oracle: ${err.message}`);
                }

                // Dann Memgraph
                try {
                    console.log('Creating in Memgraph...');
                    results.memgraph = await apiService.createNode(entityType, finalNodeData, 'memgraph');
                } catch (err) {
                    console.error('Memgraph creation failed:', err);
                    errors.push(`Memgraph: ${err.message}`);
                }

                // Gesamtergebnis zusammenstellen
                const successCount = (results.oracle ? 1 : 0) + (results.memgraph ? 1 : 0);
                setResult({
                    success: successCount > 0,
                    message: `Created in ${successCount}/2 databases`,
                    data: {
                        wikidataId: finalNodeData.id,
                        database: 'both',
                        results,
                        errors: errors.length > 0 ? errors : null
                    },
                    metadata: {
                        timestamp: new Date().toISOString(),
                        successCount,
                        totalAttempts: 2
                    }
                });

                if (errors.length > 0) {
                    setError(`Partial success: ${errors.join(', ')}`);
                }
            } else {
                // 🔄 EINZELNE DATENBANK (bestehend)
                const response = await apiService.createNode(entityType, finalNodeData, database);
                setResult(response);
            }

            setNodeData({}); // Form zurücksetzen

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
                        Wikidata ID {isRequired && <span className="text-red-500">*</span>}
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
                            Generate
                        </button>
                    </div>
                    <p className="text-xs text-gray-500">
                        Unique Wikidata identifier (Q + 10 digits)
                    </p>
                </div>
            );
        }

        if (field.includes('date')) {
            return (
                <div key={field} className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                        {field.replace('_', ' ').toUpperCase()} {isRequired && <span className="text-red-500">*</span>}
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
                        Gender {isRequired && <span className="text-red-500">*</span>}
                    </label>
                    <select
                        value={value}
                        onChange={(e) => handleInputChange(field, e.target.value)}
                        className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="">Select gender...</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                        <option value="Unknown">Unknown</option>
                    </select>
                </div>
            );
        }

        if (field === 'type') {
            const typeOptions = {
                place: ['City', 'Country', 'Region', 'Building', 'Location'],
                workplace: ['University', 'Company', 'Institution', 'Laboratory'],
                work: ['NotableWork', 'Publication', 'Patent', 'Software', 'Theory']
            };

            return (
                <div key={field} className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                        Type {isRequired && <span className="text-red-500">*</span>}
                    </label>
                    <select
                        value={value}
                        onChange={(e) => handleInputChange(field, e.target.value)}
                        className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="">Select type...</option>
                        {(typeOptions[entityType] || []).map(option => (
                            <option key={option} value={option}>{option}</option>
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
                    {field.replace('_', ' ').toUpperCase()} {isRequired && <span className="text-red-500">*</span>}
                </label>
                <InputComponent
                    type={isLongText ? undefined : "text"}
                    value={value}
                    onChange={(e) => handleInputChange(field, e.target.value)}
                    placeholder={`Enter ${field.replace('_', ' ')}...`}
                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    rows={isLongText ? 3 : undefined}
                />
                {isLongText && (
                    <p className="text-xs text-gray-500">
                        Brief description or summary
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
                    <label className="block text-sm font-medium text-gray-700">Entity Type</label>
                    <select
                        value={entityType}
                        onChange={(e) => setEntityType(e.target.value)}
                        className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="person">👤 Person</option>
                        <option value="place">📍 Place</option>
                        <option value="work">📚 Work</option>
                        <option value="award">🏆 Award</option>
                        <option value="field">🔬 Field</option>
                        <option value="occupation">💼 Occupation</option>
                        <option value="workplace">🏢 Workplace</option>
                    </select>
                </div>

                <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">Database</label>
                    <select
                        value={database}
                        onChange={(e) => setDatabase(e.target.value)}
                        className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="memgraph">🔵 Memgraph (Cypher)</option>
                        <option value="oracle">🔴 Oracle (PGQL)</option>
                        <option value="both">🔵🔴 Both Databases</option>
                    </select>
                </div>
            </div>

            {/* Form Fields */}
            <div className="space-y-4 mb-6">
                <h4 className="font-medium text-gray-900">Entity Properties</h4>

                {allFields.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {allFields.map(field => renderField(field))}
                    </div>
                ) : (
                    <div className="p-4 bg-gray-50 rounded-lg text-gray-600">
                        Loading entity configuration...
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
                            Creating...
                        </>
                    ) : (
                        <>
                            <Save size={16} />
                            Create {entityType}
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
                    Reset Form
                </button>
            </div>

            {/* Success Result */}
            {result && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center gap-2 mb-3">
                        <CheckCircle className="text-green-600" size={20} />
                        <h4 className="font-medium text-green-900">
                            ✅ {result.data?.database === 'both'
                            ? `Node created in ${result.metadata?.successCount}/2 databases!`
                            : 'Node created successfully!'
                        }
                        </h4>
                    </div>

                    <div className="space-y-2 text-sm">
                        {result.data?.database === 'both' ? (
                            // Beide Datenbanken Result
                            <>
                                <div className="grid grid-cols-3 gap-4 mb-3">
                                    <div>
                                        <strong>Wikidata ID:</strong> {result.data?.wikidataId}
                                    </div>
                                    <div>
                                        <strong>Entity Type:</strong> {entityType}
                                    </div>
                                    <div>
                                        <strong>Success Rate:</strong> {result.metadata?.successCount}/2
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* Oracle Result */}
                                    <div className={`p-3 border rounded ${result.data.results.oracle ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                                        <h5 className="font-medium text-sm flex items-center gap-2">
                                            🔴 Oracle
                                            {result.data.results.oracle ? (
                                                <span className="text-green-600">✅</span>
                                            ) : (
                                                <span className="text-red-600">❌</span>
                                            )}
                                        </h5>
                                        {result.data.results.oracle && (
                                            <p className="text-xs mt-1">
                                                Table: {result.data.results.oracle.data?.table}
                                            </p>
                                        )}
                                    </div>

                                    {/* Memgraph Result */}
                                    <div className={`p-3 border rounded ${result.data.results.memgraph ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                                        <h5 className="font-medium text-sm flex items-center gap-2">
                                            🔵 Memgraph
                                            {result.data.results.memgraph ? (
                                                <span className="text-green-600">✅</span>
                                            ) : (
                                                <span className="text-red-600">❌</span>
                                            )}
                                        </h5>
                                        {result.data.results.memgraph && (
                                            <p className="text-xs mt-1">
                                                ID: {result.data.results.memgraph.data?.memgraphId}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {result.data.errors && (
                                    <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs">
                                        <strong>Errors:</strong>
                                        <ul className="mt-1 space-y-1">
                                            {result.data.errors.map((error, idx) => (
                                                <li key={idx} className="text-red-600">• {error}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </>
                        ) : (
                            // Einzelne Datenbank Result (bestehend)
                            <>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <strong>Wikidata ID:</strong> {result.data?.wikidataId}
                                    </div>
                                    <div>
                                        <strong>Database:</strong> {result.data?.database}
                                    </div>
                                    <div>
                                        <strong>Entity Type:</strong> {entityType}
                                    </div>
                                    <div>
                                        <strong>Created:</strong> {new Date(result.metadata?.timestamp).toLocaleString()}
                                    </div>
                                </div>

                                {result.data?.node && (
                                    <div className="mt-3 p-3 bg-white border rounded text-xs">
                                        <strong>Created Node:</strong>
                                        <pre className="mt-1 overflow-x-auto">
                                            {JSON.stringify(result.data.node, null, 2)}
                                        </pre>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Error Display */}
            {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                        <AlertCircle className="text-red-600" size={20} />
                        <h4 className="font-medium text-red-900">❌ Creation failed</h4>
                    </div>
                    <p className="text-red-700 text-sm">{error}</p>
                </div>
            )}

            {/* Info Box */}
            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm">
                <h5 className="font-medium text-blue-900 mb-2">💡 Usage Tips:</h5>
                <ul className="text-blue-800 space-y-1">
                    <li>• <strong>Required fields</strong> are marked with a red asterisk (*)</li>
                    <li>• <strong>Wikidata ID</strong> will be auto-generated if not provided</li>
                    <li>• <strong>Oracle</strong> inserts into base tables, <strong>Memgraph</strong> creates nodes directly</li>
                    <li>• All dates should be in YYYY-MM-DD format</li>
                    <li>• Names should be unique within the same entity type</li>
                </ul>
            </div>
        </div>
    );
};

export default NodeCreator;