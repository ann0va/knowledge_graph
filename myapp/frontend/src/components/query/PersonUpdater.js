// src/components/query/PersonUpdater.js - Multi-Database Support für Person Updates
import React, { useState, useEffect } from 'react';
import { Edit3, Search, Save, RefreshCw, AlertTriangle, CheckCircle, AlertCircle, Bug, Eye, User } from 'lucide-react';
import apiService from '../../services/api';
import EntityDropdown from './shared/EntityDropdown';

const PersonUpdater = () => {
    const [database, setDatabase] = useState('both'); // 🔧 FIXED: Default zu both
    const [selectedPersonName, setSelectedPersonName] = useState('');
    const [wikidataId, setWikidataId] = useState('');

    const [personInfo, setPersonInfo] = useState(null);
    const [searching, setSearching] = useState(false);
    const [updating, setUpdating] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState('');

    // Update-spezifische States
    const [selectedProperty, setSelectedProperty] = useState('');
    const [newValue, setNewValue] = useState('');
    const [oldValue, setOldValue] = useState('');
    const [showPropertyDetails, setShowPropertyDetails] = useState(false);

    // Verfügbare Person-Eigenschaften (fest definiert)
    const personProperties = [
        { key: 'name', label: 'Name', type: 'text', required: true },
        { key: 'birth_date', label: 'Geburtsdatum', type: 'date', required: false },
        { key: 'death_date', label: 'Todesdatum', type: 'date', required: false },
        { key: 'gender', label: 'Geschlecht', type: 'text', required: false },
        { key: 'description', label: 'Beschreibung', type: 'text', required: false }
    ];

    // DEBUG: Add debug information
    const [debugInfo, setDebugInfo] = useState([]);
    const [showDebug, setShowDebug] = useState(false);

    const addDebugInfo = (message, data = null) => {
        const timestamp = new Date().toLocaleTimeString();
        const debugEntry = { timestamp, message, data };
        setDebugInfo(prev => [...prev, debugEntry]);
        console.log(`[PersonUpdater Debug ${timestamp}] ${message}`, data);
    };

    // Reset bei Database Änderung
    useEffect(() => {
        setSelectedPersonName('');
        setWikidataId('');
        setPersonInfo(null);
        setError('');
        setResult(null);
        setSelectedProperty('');
        setNewValue('');
        setOldValue('');
        setDebugInfo([]);
    }, [database]);

    // Reset Update-Felder wenn neue Person gewählt wird
    useEffect(() => {
        setSelectedProperty('');
        setNewValue('');
        setOldValue('');
        setResult(null);
        setError('');
    }, [wikidataId, personInfo]);

    // ID Extraction für Oracle/Memgraph
    const extractIdFromEntity = (entity, database) => {
        addDebugInfo(`Extracting ID from entity`, { entity, database });

        if (database === 'oracle') {
            let id = entity.id || entity.ID || entity.VERTEX_ID;

            if (id && id.includes('(')) {
                const match = id.match(/\(([^)]+)\)/);
                if (match) {
                    const extractedId = match[1];
                    addDebugInfo(`Extracted Oracle ID from parentheses: ${extractedId}`);
                    return extractedId;
                }
            }
            addDebugInfo(`Using Oracle ID as-is: ${id}`);
            return id;
        } else {
            const id = entity['e.id'] || entity.id;
            addDebugInfo(`Memgraph ID: ${id}`);
            return id;
        }
    };

    // Person Name Changed - ID extrahieren
    const handlePersonNameChange = async (personName) => {
        addDebugInfo(`Person name changed to: "${personName}"`);

        setSelectedPersonName(personName);
        setWikidataId('');
        setPersonInfo(null);
        setError('');
        setResult(null);

        if (personName.trim() === '') return;

        try {
            let extractedId = null;

            if (database !== 'both') {
                addDebugInfo(`Searching in ${database} for person: ${personName}`);

                const searchResult = await apiService.searchEntityNames('person', personName, database, 10);
                addDebugInfo(`Search result for ${database}`, searchResult);

                if (searchResult.success && searchResult.data.results.length > 0) {
                    const exactMatch = searchResult.data.results.find(entity => {
                        const entityNameFromResult = database === 'oracle'
                            ? (entity.NAME || entity.name)
                            : (entity['e.name'] || entity.name);

                        return entityNameFromResult === personName;
                    });

                    const entity = exactMatch || searchResult.data.results[0];
                    extractedId = extractIdFromEntity(entity, database);
                }
            } else {
                // Both databases search
                const [memgraphResult, oracleResult] = await Promise.allSettled([
                    apiService.searchEntityNames('person', personName, 'memgraph', 10),
                    apiService.searchEntityNames('person', personName, 'oracle', 10)
                ]);

                // Try Memgraph first
                if (memgraphResult.status === 'fulfilled' && memgraphResult.value.success) {
                    const exactMatch = memgraphResult.value.data.results.find(entity => {
                        const entityNameFromResult = entity['e.name'] || entity.name;
                        return entityNameFromResult === personName;
                    });

                    if (exactMatch) {
                        extractedId = extractIdFromEntity(exactMatch, 'memgraph');
                    }
                }

                // If not found in Memgraph, try Oracle
                if (!extractedId && oracleResult.status === 'fulfilled' && oracleResult.value.success) {
                    const exactMatch = oracleResult.value.data.results.find(entity => {
                        const entityNameFromResult = entity.NAME || entity.name;
                        return entityNameFromResult === personName;
                    });

                    if (exactMatch) {
                        extractedId = extractIdFromEntity(exactMatch, 'oracle');
                    }
                }
            }

            if (extractedId) {
                addDebugInfo(`Successfully extracted ID: ${extractedId}`);
                setWikidataId(extractedId);
            }
        } catch (err) {
            addDebugInfo(`Error during ID extraction`, err);
            console.warn('Could not extract Wikidata ID:', err);
        }
    };

    // 🆕 MULTI-DATABASE: Person in beiden Datenbanken suchen
    const searchPersonInBothDatabases = async (wikidataId) => {
        const results = {
            memgraph: null,
            oracle: null,
            success: false,
            errors: []
        };

        // Memgraph
        try {
            console.log('🔵 Searching person in Memgraph...');
            const memgraphResult = await apiService.getEntity('person', wikidataId, 'memgraph');
            if (memgraphResult.success && memgraphResult.data.entity) {
                results.memgraph = memgraphResult.data.entity;
                console.log('✅ Memgraph person found:', results.memgraph);
            }
        } catch (memgraphError) {
            console.error('❌ Memgraph person search failed:', memgraphError);
            results.errors.push({
                database: 'memgraph',
                error: memgraphError.message
            });
        }

        // Oracle
        try {
            console.log('🔴 Searching person in Oracle...');
            const oracleResult = await apiService.getEntity('person', wikidataId, 'oracle');
            if (oracleResult.success && oracleResult.data.entity) {
                results.oracle = oracleResult.data.entity;
                console.log('✅ Oracle person found:', results.oracle);
            }
        } catch (oracleError) {
            console.error('❌ Oracle person search failed:', oracleError);
            results.errors.push({
                database: 'oracle',
                error: oracleError.message
            });
        }

        // Erfolg wenn mindestens eine Datenbank erfolgreich war
        results.success = results.memgraph || results.oracle;

        return results;
    };

    // Person für Update suchen - ENHANCED mit Multi-Database Support
    const searchPersonForUpdate = async () => {
        if (!wikidataId.trim()) {
            setError('Bitte wählen Sie eine Person aus oder geben Sie eine Wikidata-ID ein');
            return;
        }

        addDebugInfo(`Starting person search for update`, { wikidataId, database });

        setSearching(true);
        setError('');
        setPersonInfo(null);

        try {
            if (database === 'both') {
                // 🆕 Multi-Database Search
                const searchResults = await searchPersonInBothDatabases(wikidataId);

                if (searchResults.success) {
                    addDebugInfo(`Multi-database person search successful`, searchResults);

                    // Combine data from both databases, prioritizing Memgraph for display
                    const primaryPerson = searchResults.memgraph || searchResults.oracle;

                    setPersonInfo({
                        success: true,
                        person: primaryPerson,
                        canUpdate: true,
                        multiDatabase: true,
                        memgraphData: searchResults.memgraph,
                        oracleData: searchResults.oracle,
                        errors: searchResults.errors
                    });
                } else {
                    const errorMessages = searchResults.errors.map(e => `${e.database}: ${e.error}`).join('\n');
                    throw new Error(`Person mit ID "${wikidataId}" nicht in beiden Datenbanken gefunden.\n\nFehler:\n${errorMessages}`);
                }

            } else if (database === 'oracle') {
                // 🔧 ORACLE WORKAROUND: Try multiple approaches for Oracle
                addDebugInfo(`Oracle detected - trying multiple approaches for ${wikidataId}`);

                // First try: Standard API call
                try {
                    const personResponse = await apiService.getEntity('person', wikidataId, database);

                    if (personResponse.success && personResponse.data.entity) {
                        addDebugInfo(`Oracle person search successful (standard API)`, personResponse);

                        setPersonInfo({
                            success: true,
                            person: personResponse.data.entity,
                            canUpdate: true
                        });
                        return; // Success!
                    }
                } catch (standardError) {
                    addDebugInfo(`Oracle standard API failed`, standardError);

                    // Second try: Search by name and find exact match
                    if (selectedPersonName) {
                        addDebugInfo(`Trying Oracle search by name: ${selectedPersonName}`);

                        try {
                            const searchResult = await apiService.searchEntityNames('person', selectedPersonName, 'oracle', 10);

                            if (searchResult.success && searchResult.data.results.length > 0) {
                                const foundPerson = searchResult.data.results.find(person => {
                                    const personId = extractIdFromEntity(person, 'oracle');
                                    return personId === wikidataId;
                                });

                                if (foundPerson) {
                                    addDebugInfo(`Found person via Oracle search`, foundPerson);

                                    setPersonInfo({
                                        success: true,
                                        person: {
                                            name: foundPerson.NAME || foundPerson.name,
                                            id: wikidataId,
                                            birth_date: foundPerson.BIRTH_DATE || foundPerson.birth_date,
                                            death_date: foundPerson.DEATH_DATE || foundPerson.death_date,
                                            gender: foundPerson.GENDER || foundPerson.gender,
                                            description: foundPerson.DESCRIPTION || foundPerson.description,
                                            ...foundPerson
                                        },
                                        canUpdate: true
                                    });
                                    return; // Success!
                                }
                            }
                        } catch (searchError) {
                            addDebugInfo(`Oracle search by name also failed`, searchError);
                        }
                    }

                    // If all else fails, show helpful error for Oracle
                    throw new Error(`Oracle Backend-Problem: Person mit ID "${wikidataId}" konnte nicht geladen werden. 

Mögliche Lösungen:
1. Wählen Sie die Person zuerst aus dem Dropdown aus
2. Prüfen Sie ob die Person in Oracle existiert
3. Kontaktieren Sie das Backend-Team wegen Oracle PGQL-Problemen

Technischer Fehler: ${standardError.message}`);
                }

            } else {
                // Memgraph - funktioniert normal
                const personResponse = await apiService.getEntity('person', wikidataId, database);

                if (personResponse.success && personResponse.data.entity) {
                    addDebugInfo(`Memgraph person search successful`, personResponse);

                    setPersonInfo({
                        success: true,
                        person: personResponse.data.entity,
                        canUpdate: true
                    });
                } else {
                    throw new Error(`Person mit ID "${wikidataId}" nicht in ${database}-Datenbank gefunden`);
                }
            }

        } catch (err) {
            addDebugInfo(`Person search failed`, err);

            let errorMessage = err.message;

            if (err.message.includes('404') || err.message.includes('not found')) {
                errorMessage = `Person mit ID "${wikidataId}" nicht in ${database === 'both' ? 'den' : database}-Datenbank${database === 'both' ? 'en' : ''} gefunden. Bitte prüfen Sie:
• Die Wikidata-ID ist korrekt
• Die Person existiert in der ${database === 'both' ? 'gewählten' : database}-Datenbank${database === 'both' ? 'en' : ''}`;
            } else if (err.message.includes('500')) {
                errorMessage = `Server-Fehler beim Suchen in ${database === 'both' ? 'den Datenbanken' : database}. 

${database === 'oracle' || database === 'both' ?
                    '🔴 Oracle hat bekannte Backend-Probleme. Versuchen Sie:\n• Person aus Dropdown auswählen\n• Memgraph verwenden\n• Backend-Team kontaktieren'
                    : 'Bitte versuchen Sie es erneut.'
                }

Technischer Fehler: ${err.message}`;
            }

            setError(errorMessage);
        } finally {
            setSearching(false);
        }
    };

    // Eigenschaft auswählen - alten Wert laden - ENHANCED für Multi-Database
    const handlePropertyChange = (propertyKey) => {
        addDebugInfo(`Property selected: ${propertyKey}`);

        setSelectedProperty(propertyKey);
        setNewValue('');

        if (personInfo && personInfo.person && propertyKey) {
            let currentValue = '';

            if (database === 'both') {
                // Multi-Database: Prioritize Memgraph data, fallback to Oracle
                const memgraphPerson = personInfo.memgraphData;
                const oraclePerson = personInfo.oracleData;

                if (memgraphPerson) {
                    currentValue = memgraphPerson[propertyKey] || memgraphPerson[`e.${propertyKey}`] || '';
                }

                if (!currentValue && oraclePerson) {
                    const oracleKey = propertyKey.toUpperCase();
                    currentValue = oraclePerson[oracleKey] || oraclePerson[propertyKey] || '';
                }

                addDebugInfo(`Multi-database property lookup: ${propertyKey}`, {
                    memgraphValue: memgraphPerson?.[propertyKey] || memgraphPerson?.[`e.${propertyKey}`],
                    oracleValue: oraclePerson?.[propertyKey.toUpperCase()] || oraclePerson?.[propertyKey],
                    finalValue: currentValue
                });

            } else if (database === 'oracle') {
                // Oracle: Properties können in verschiedenen Cases sein
                const oracleKey = propertyKey.toUpperCase();
                currentValue = personInfo.person[oracleKey] ||
                    personInfo.person[propertyKey] || '';

                addDebugInfo(`Oracle property lookup: ${propertyKey} -> ${oracleKey}`, {
                    oracleKey,
                    value: currentValue,
                    availableKeys: Object.keys(personInfo.person)
                });
            } else {
                // Memgraph: Normale Suche
                currentValue = personInfo.person[propertyKey] ||
                    personInfo.person[`e.${propertyKey}`] || '';

                addDebugInfo(`Memgraph property lookup: ${propertyKey}`, {
                    value: currentValue,
                    availableKeys: Object.keys(personInfo.person)
                });
            }

            // Datum-Formatting für Oracle (entferne Timestamp)
            if ((propertyKey === 'birth_date' || propertyKey === 'death_date') && currentValue) {
                if (typeof currentValue === 'string' && currentValue.includes(' ')) {
                    // Oracle Format: "1873-11-09 00:00:00.0" -> "1873-11-09"
                    currentValue = currentValue.split(' ')[0];
                    addDebugInfo(`Formatted Oracle date: ${currentValue}`);
                }
            }

            setOldValue(currentValue);
            setNewValue(currentValue); // Pre-fill mit aktuellem Wert

            addDebugInfo(`Loaded current value for property ${propertyKey}`, {
                originalValue: currentValue,
                formattedValue: currentValue
            });
        } else {
            setOldValue('');
        }
    };

    // 🆕 MULTI-DATABASE: Person Property Update in beiden Datenbanken
    const updatePersonPropertyInBothDatabases = async (wikidataId, property, newValue) => {
        const results = {
            memgraph: null,
            oracle: null,
            success: false,
            errors: []
        };

        // Memgraph Update
        try {
            console.log('🔵 Updating person property in Memgraph...');
            const memgraphResult = await apiService.updatePersonProperty(wikidataId, property, newValue, 'memgraph');
            results.memgraph = memgraphResult;
            console.log('✅ Memgraph person property updated:', memgraphResult);
        } catch (memgraphError) {
            console.error('❌ Memgraph person property update failed:', memgraphError);
            results.errors.push({
                database: 'memgraph',
                error: memgraphError.message
            });
        }

        // Oracle Update
        try {
            console.log('🔴 Updating person property in Oracle...');
            const oracleResult = await apiService.updatePersonProperty(wikidataId, property, newValue, 'oracle');
            results.oracle = oracleResult;
            console.log('✅ Oracle person property updated:', oracleResult);
        } catch (oracleError) {
            console.error('❌ Oracle person property update failed:', oracleError);
            results.errors.push({
                database: 'oracle',
                error: oracleError.message
            });
        }

        // Erfolg wenn mindestens eine Datenbank erfolgreich war
        results.success = results.memgraph || results.oracle;

        return results;
    };

    // Person Property Update - ENHANCED mit Multi-Database Support
    const updatePersonProperty = async () => {
        if (!personInfo || !selectedProperty || newValue.trim() === '') {
            setError('Bitte füllen Sie alle Felder aus');
            return;
        }

        if (newValue === oldValue) {
            setError('Der neue Wert ist identisch mit dem alten Wert. Keine Änderung erforderlich.');
            return;
        }

        // Validierung für Personen-spezifische Regeln
        const selectedProp = personProperties.find(p => p.key === selectedProperty);
        if (selectedProp) {
            if (selectedProp.type === 'date' && newValue) {
                const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
                if (!dateRegex.test(newValue)) {
                    setError('Datum muss im Format YYYY-MM-DD eingegeben werden');
                    return;
                }
            }

            // Datum-Logik-Validierung
            if (selectedProperty === 'death_date' && newValue && personInfo.person.birth_date) {
                const birthDate = new Date(personInfo.person.birth_date);
                const deathDate = new Date(newValue);
                if (deathDate <= birthDate) {
                    setError('Todesdatum muss nach dem Geburtsdatum liegen');
                    return;
                }
            }
        }

        addDebugInfo(`Starting person property update`, {
            wikidataId,
            database,
            property: selectedProperty,
            oldValue,
            newValue
        });

        setUpdating(true);
        setError('');
        setResult(null);

        try {
            let response;

            if (database === 'both') {
                // 🆕 Multi-Database Update
                response = await updatePersonPropertyInBothDatabases(wikidataId, selectedProperty, newValue);
            } else {
                // Single Database Update
                response = await apiService.updatePersonProperty(wikidataId, selectedProperty, newValue, database);
            }

            addDebugInfo(`Person property update completed`, response);

            setResult(response);

            // Person neu laden um aktuelle Daten zu zeigen bei Erfolg
            if ((database === 'both' && response.success) || (database !== 'both' && response.success)) {
                await searchPersonForUpdate();
            }

        } catch (err) {
            addDebugInfo(`Person property update failed`, err);
            setError(err.message);
        } finally {
            setUpdating(false);
        }
    };

    return (
        <div className="bg-white rounded-lg border p-6">
            <div className="flex items-center gap-3 mb-6">
                <User className="text-blue-600" size={24} />
                <div>
                    <h3 className="text-lg font-semibold text-gray-900">Person-Eigenschaften aktualisieren</h3>
                    <p className="text-gray-600">Bearbeite die Eigenschaften einer Person (Name, Geburtsdatum, etc.)</p>
                </div>

                {/* Debug Toggle */}
                <button
                    onClick={() => setShowDebug(!showDebug)}
                    className="ml-auto p-2 text-gray-400 hover:text-gray-600"
                    title="Debug-Informationen umschalten"
                >
                    <Bug size={16} />
                </button>
            </div>

            {/* Debug Information */}
            {showDebug && debugInfo.length > 0 && (
                <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <h4 className="font-medium text-yellow-900 mb-3 flex items-center gap-2">
                        <Bug size={16} />
                        Debug-Informationen
                    </h4>
                    <div className="max-h-40 overflow-y-auto text-xs space-y-1">
                        {debugInfo.slice(-10).map((info, index) => (
                            <div key={index} className="text-yellow-800">
                                <span className="font-mono">[{info.timestamp}]</span> {info.message}
                                {info.data && (
                                    <pre className="mt-1 ml-4 text-yellow-700 overflow-x-auto">
                                        {JSON.stringify(info.data, null, 2)}
                                    </pre>
                                )}
                            </div>
                        ))}
                    </div>
                    <button
                        onClick={() => setDebugInfo([])}
                        className="mt-2 text-xs text-yellow-700 hover:text-yellow-900"
                    >
                        Debug-Log löschen
                    </button>
                </div>
            )}

            {/* Database Selection - ENHANCED mit Multi-Database Option */}
            <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Ziel-Datenbank</label>
                <select
                    value={database}
                    onChange={(e) => setDatabase(e.target.value)}
                    className="w-full max-w-md p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                    <option value="both">🔵🔴 Beide Datenbanken</option>
                    <option value="memgraph">🔵 Memgraph (Cypher)</option>
                    <option value="oracle">🔴 Oracle (PGQL)</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                    {database === 'both'
                        ? 'Person-Update erfolgt in beiden Datenbanken parallel'
                        : `Update erfolgt nur in der ${database === 'memgraph' ? 'Memgraph' : 'Oracle'}-Datenbank`
                    }
                </p>
            </div>

            {/* Person Selection */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
                <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                        👤 Person auswählen
                        <span className="text-sm text-gray-500 ml-1">(aus beiden Datenbanken)</span>
                    </label>
                    <EntityDropdown
                        value={selectedPersonName}
                        onChange={handlePersonNameChange}
                        entityType="person"
                        database="both"
                        placeholder="Wählen Sie eine Person zum Bearbeiten..."
                        showDatabaseIndicator={true}
                    />
                    <p className="text-xs text-gray-500">
                        🔵 = Memgraph, 🔴 = Oracle, 🔵🔴 = Beide Datenbanken
                    </p>
                </div>

                <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                        Wikidata-ID
                        <span className="text-sm text-gray-500 ml-1">(automatisch ausgefüllt)</span>
                    </label>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={wikidataId}
                            onChange={(e) => setWikidataId(e.target.value)}
                            placeholder="Q1234567890"
                            className="flex-1 p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                        <button
                            onClick={searchPersonForUpdate}
                            disabled={searching || !wikidataId.trim()}
                            className={`px-4 py-3 text-white rounded-lg hover:opacity-90 disabled:opacity-50 flex items-center gap-2 ${
                                database === 'oracle' ? 'bg-red-600 hover:bg-red-700' :
                                    database === 'memgraph' ? 'bg-blue-600 hover:bg-blue-700' :
                                        'bg-purple-600 hover:bg-purple-700'
                            }`}
                        >
                            {searching ? (
                                <RefreshCw size={16} className="animate-spin" />
                            ) : (
                                <Search size={16} />
                            )}
                            In {database === 'oracle' ? '🔴 Oracle' :
                            database === 'memgraph' ? '🔵 Memgraph' :
                                '🔵🔴 Beiden DBs'} suchen
                        </button>
                    </div>
                </div>
            </div>

            {/* Person Information - ENHANCED für Multi-Database */}
            {personInfo && (
                <div className="mb-6 p-4 border rounded-lg bg-gray-50">
                    <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                        <User size={16} />
                        Person gefunden in {database === 'both' ? 'den Datenbanken' : database}
                        {personInfo.multiDatabase && (
                            <span className="ml-2 px-2 py-1 text-xs bg-purple-100 text-purple-800 rounded">
                                Multi-Database
                            </span>
                        )}
                    </h4>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div>
                            <strong>Name:</strong> {
                            database === 'oracle' && !personInfo.multiDatabase
                                ? (personInfo.person?.NAME || personInfo.person?.name || 'N/A')
                                : (personInfo.person?.name || personInfo.person?.['e.name'] || 'N/A')
                        }
                        </div>
                        <div>
                            <strong>Wikidata-ID:</strong> {wikidataId}
                        </div>
                        <div>
                            <strong>Verfügbar in:</strong>
                            {personInfo.multiDatabase ? (
                                <div className="flex gap-1 mt-1">
                                    {personInfo.memgraphData && (
                                        <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">🔵 Memgraph</span>
                                    )}
                                    {personInfo.oracleData && (
                                        <span className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded">🔴 Oracle</span>
                                    )}
                                </div>
                            ) : (
                                <span className={`ml-2 px-2 py-1 text-xs rounded ${
                                    database === 'memgraph' ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'
                                }`}>
                                    {database === 'memgraph' ? '🔵 Memgraph' : '🔴 Oracle'}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Multi-Database Status */}
                    {personInfo.multiDatabase && personInfo.errors && personInfo.errors.length > 0 && (
                        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
                            <h5 className="font-medium text-yellow-900 mb-2">⚠️ Teilweise Verfügbarkeit:</h5>
                            <ul className="text-sm text-yellow-800 space-y-1">
                                {personInfo.errors.map((error, idx) => (
                                    <li key={idx}>
                                        • {error.database === 'memgraph' ? '🔵' : '🔴'} {error.database}: {error.error}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Property Details Toggle */}
                    <div className="mb-4">
                        <button
                            onClick={() => setShowPropertyDetails(!showPropertyDetails)}
                            className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800"
                        >
                            <Eye size={14} />
                            {showPropertyDetails ? 'Eigenschaften verbergen' : 'Alle Eigenschaften anzeigen'}
                        </button>
                    </div>

                    {/* All Person Properties - ENHANCED für Multi-Database */}
                    {showPropertyDetails && personInfo.person && (
                        <div className="space-y-3">
                            {personInfo.multiDatabase ? (
                                // Multi-Database View
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {personInfo.memgraphData && (
                                        <div className="p-3 bg-blue-50 border border-blue-200 rounded text-xs">
                                            <strong className="text-blue-900">🔵 Memgraph-Eigenschaften:</strong>
                                            <pre className="mt-1 overflow-x-auto text-blue-800">
                                                {JSON.stringify(personInfo.memgraphData, null, 2)}
                                            </pre>
                                        </div>
                                    )}
                                    {personInfo.oracleData && (
                                        <div className="p-3 bg-red-50 border border-red-200 rounded text-xs">
                                            <strong className="text-red-900">🔴 Oracle-Eigenschaften:</strong>
                                            <pre className="mt-1 overflow-x-auto text-red-800">
                                                {JSON.stringify(personInfo.oracleData, null, 2)}
                                            </pre>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                // Single Database View
                                <div className="p-3 bg-white border rounded text-xs">
                                    <strong>Alle Person-Eigenschaften ({database}):</strong>
                                    <pre className="mt-1 overflow-x-auto text-gray-600">
                                        {JSON.stringify(personInfo.person, null, 2)}
                                    </pre>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Property Update Section - ENHANCED für Multi-Database */}
            {personInfo && (
                <div className="mb-6 p-4 border-2 border-blue-200 rounded-lg bg-blue-50">
                    <h4 className="font-medium text-blue-900 mb-4 flex items-center gap-2">
                        <Edit3 size={16} />
                        Person-Eigenschaft bearbeiten
                        {database === 'both' && (
                            <span className="ml-2 px-2 py-1 text-xs bg-purple-100 text-purple-800 rounded">
                                Multi-Database Update
                            </span>
                        )}
                    </h4>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        {/* Property Selection */}
                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-gray-700">Eigenschaft auswählen</label>
                            <select
                                value={selectedProperty}
                                onChange={(e) => handlePropertyChange(e.target.value)}
                                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="">-- Eigenschaft wählen --</option>
                                {personProperties.map(property => (
                                    <option key={property.key} value={property.key}>
                                        {property.label} {property.required && '*'}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Current Value Display - ENHANCED für Multi-Database */}
                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-gray-700">
                                Aktueller Wert
                                {database === 'both' && (
                                    <span className="text-xs text-gray-500 ml-1">(aus Memgraph, falls verfügbar)</span>
                                )}
                            </label>
                            <div className="p-3 bg-gray-100 border rounded-lg">
                                <code className="text-sm text-gray-800">
                                    {oldValue || '(leer)'}
                                </code>
                            </div>
                        </div>

                        {/* New Value Input */}
                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-gray-700">Neuer Wert</label>
                            {selectedProperty && personProperties.find(p => p.key === selectedProperty)?.type === 'date' ? (
                                <input
                                    type="date"
                                    value={newValue}
                                    onChange={(e) => setNewValue(e.target.value)}
                                    disabled={!selectedProperty}
                                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                                />
                            ) : (
                                <input
                                    type="text"
                                    value={newValue}
                                    onChange={(e) => setNewValue(e.target.value)}
                                    placeholder="Neuen Wert eingeben..."
                                    disabled={!selectedProperty}
                                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                                />
                            )}
                        </div>
                    </div>

                    {/* Update Preview */}
                    {selectedProperty && newValue && newValue !== oldValue && (
                        <div className="mt-4 p-3 bg-white border border-blue-300 rounded-lg">
                            <h5 className="font-medium text-gray-900 mb-2">Vorschau der Änderung:</h5>
                            <div className="text-sm">
                                <span className="font-medium">
                                    {personProperties.find(p => p.key === selectedProperty)?.label}:
                                </span>
                                <span className="ml-2 line-through text-red-600">"{oldValue}"</span>
                                <span className="mx-2">→</span>
                                <span className="text-green-600 font-medium">"{newValue}"</span>

                                {database === 'both' && (
                                    <div className="mt-2 text-xs text-purple-600">
                                        ⚡ Änderung wird in beiden Datenbanken gleichzeitig durchgeführt
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Update Button - ENHANCED für Multi-Database */}
                    <div className="mt-4 flex gap-3">
                        <button
                            onClick={updatePersonProperty}
                            disabled={updating || !selectedProperty || !newValue || newValue === oldValue}
                            className={`flex items-center gap-2 px-6 py-3 text-white rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed ${
                                database === 'both' ? 'bg-purple-600 hover:bg-purple-700' :
                                    database === 'oracle' ? 'bg-red-600 hover:bg-red-700' :
                                        'bg-blue-600 hover:bg-blue-700'
                            }`}
                        >
                            {updating ? (
                                <>
                                    <RefreshCw size={16} className="animate-spin" />
                                    {database === 'both' ? 'Update in beiden DBs...' : 'Aktualisiere...'}
                                </>
                            ) : (
                                <>
                                    <Save size={16} />
                                    {database === 'both' ? 'In beiden Datenbanken aktualisieren' : 'Person-Eigenschaft aktualisieren'}
                                </>
                            )}
                        </button>

                        <button
                            onClick={() => {
                                setSelectedProperty('');
                                setNewValue('');
                                setOldValue('');
                                setError('');
                                setResult(null);
                            }}
                            className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                        >
                            Update zurücksetzen
                        </button>
                    </div>
                </div>
            )}

            {/* Success Result - ENHANCED für Multi-Database */}
            {result && (
                <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center gap-2 mb-3">
                        <CheckCircle className="text-green-600" size={20} />
                        <h4 className="font-medium text-green-900">
                            {database === 'both'
                                ? '✅ Person-Update abgeschlossen!'
                                : '✅ Person-Eigenschaft erfolgreich aktualisiert!'
                            }
                        </h4>
                    </div>

                    {database === 'both' ? (
                        // Multi-Database Result
                        <div className="space-y-4">
                            <div className="grid grid-cols-3 gap-4 mb-3">
                                <div>
                                    <strong>Person-ID:</strong> {wikidataId}
                                </div>
                                <div>
                                    <strong>Eigenschaft:</strong> {personProperties.find(p => p.key === selectedProperty)?.label}
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
                                            <div>Update erfolgreich</div>
                                            <div><strong>Eigenschaft:</strong> {result.memgraph.data?.updatedProperty?.name}</div>
                                            <div><strong>Neuer Wert:</strong> {result.memgraph.data?.updatedProperty?.newValue}</div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="p-3 bg-red-50 border border-red-200 rounded">
                                        <h5 className="font-medium text-red-900 mb-2 flex items-center gap-2">
                                            🔵 Memgraph <span className="text-red-600">❌</span>
                                        </h5>
                                        <div className="text-sm text-red-800">
                                            Fehlgeschlagen: {result.errors?.find(e => e.database === 'memgraph')?.error || 'Unbekannter Fehler'}
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
                                            <div>Update erfolgreich</div>
                                            <div><strong>Eigenschaft:</strong> {result.oracle.data?.updatedProperty?.name}</div>
                                            <div><strong>Neuer Wert:</strong> {result.oracle.data?.updatedProperty?.newValue}</div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="p-3 bg-red-50 border border-red-200 rounded">
                                        <h5 className="font-medium text-red-900 mb-2 flex items-center gap-2">
                                            🔴 Oracle <span className="text-red-600">❌</span>
                                        </h5>
                                        <div className="text-sm text-red-800">
                                            Fehlgeschlagen: {result.errors?.find(e => e.database === 'oracle')?.error || 'Unbekannter Fehler'}
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
                                    <strong>Aktualisierte Person:</strong> {result.data?.updatedNode?.wikidataId}
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
                                    <strong>Eigenschaft:</strong>
                                    {personProperties.find(p => p.key === result.data?.updatedProperty?.name)?.label || result.data?.updatedProperty?.name}
                                </div>
                                <div>
                                    <strong>Neuer Wert:</strong> {result.data?.updatedProperty?.newValue}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Error Display */}
            {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                        <AlertCircle className="text-red-600" size={20} />
                        <h4 className="font-medium text-red-900">❌ Update fehlgeschlagen</h4>
                    </div>
                    <pre className="text-red-700 text-sm whitespace-pre-wrap">{error}</pre>
                </div>
            )}

            {/* Info Box - ENHANCED für Multi-Database */}
            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm">
                <h5 className="font-medium text-blue-900 mb-2">👤 Person-Update Hinweise:</h5>
                <ul className="text-blue-800 space-y-1">
                    <li>• <strong>Multi-Database:</strong> Updates können in beiden Datenbanken gleichzeitig durchgeführt werden</li>
                    <li>• <strong>Nur für Personen:</strong> Andere Entity-Typen haben keine bearbeitbaren Eigenschaften</li>
                    <li>• <strong>Verfügbare Felder:</strong> Name, Geburtsdatum, Todesdatum, Geschlecht, Beschreibung</li>
                    <li>• <strong>Datum-Format:</strong> YYYY-MM-DD (z.B. 1912-06-23)</li>
                    <li>• <strong>Validierung:</strong> Todesdatum muss nach Geburtsdatum liegen</li>
                    <li>• <strong>Echtzeit-Update:</strong> Nach erfolgreichem Update werden die Daten neu geladen</li>
                    <li>• <strong>Fehlerbehandlung:</strong> Bei Multi-Database wird auch bei Teilfehlern der Erfolg angezeigt</li>
                    <li>• <strong>Debug-Modus:</strong> Klicke auf <Bug size={12} className="inline" /> für detaillierte Logs</li>
                </ul>
            </div>
        </div>
    );
};

export default PersonUpdater;