import React, { useState } from 'react';
import { RefreshCw, Database, Users, Award, MapPin, Briefcase, FileText, Building } from 'lucide-react';
import apiService from '../../services/api';

const DataViewer = () => {
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);

    // Entity-Typ Icons
    const getEntityIcon = (entityType) => {
        const icons = {
            person: Users,
            award: Award,
            place: MapPin,
            occupation: Briefcase,
            work: FileText,
            workplace: Building,
            field: Database
        };
        const Icon = icons[entityType] || Database;
        return <Icon size={16} className="inline mr-1" />;
    };

    // Alle Daten laden
    const loadAllData = async () => {
        setLoading(true);
        setError(null);

        try {
            const entityTypes = apiService.getAvailableEntityTypes();
            const results = {};

            // Für jeden Entity-Typ Daten von beiden Datenbanken laden
            for (const entityType of entityTypes) {
                try {
                    const data = await apiService.getEntities(entityType, {
                        source: 'both',
                        limit: 200
                    });

                    // Debug: Log die API Response
                    console.log(`API Response für ${entityType}:`, data);

                    results[entityType] = data;
                } catch (err) {
                    console.warn(`Fehler beim Laden von ${entityType}:`, err);
                    results[entityType] = { success: false, error: err.message, data: { oracle: [], memgraph: [] } };
                }
            }

            // Debug: Log alle Results
            console.log('Alle API Results:', results);

            setData(results);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // Intelligente Kapitalisierung mit nativer JS-Lösung
    const smartCapitalize = (text) => {
        if (!text) return text;

        // Einfache, erweiterbare Lösung ohne feste Listen
        return text
            .toLowerCase()
            .split(' ')
            .map((word, index) => {
                // Erstes Wort immer groß
                if (index === 0) {
                    return word.charAt(0).toUpperCase() + word.slice(1);
                }

                // Kleine Füllwörter (erweiterbares Muster)
                const smallWords = /^(of|the|and|for|to|in|on|with|an?|at|by|from)$/i;
                if (smallWords.test(word)) {
                    return word.toLowerCase();
                }

                // Alles andere wird kapitalisiert
                return word.charAt(0).toUpperCase() + word.slice(1);
            })
            .join(' ');
    };

    // Sentence Case für Beschreibungen
    const sentenceCase = (text) => {
        if (!text) return text;

        return text
            .trim()
            .split(/\.\s+/) // Split by sentences
            .map(sentence => {
                if (!sentence) return sentence;
                const trimmed = sentence.trim();
                return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
            })
            .join('. ');
    };

    // 1. WIKIDATA ID EXTRAKTION - Zeile ~108
    const extractWikidataId = (item, source) => {
        if (source === 'oracle') {
            // Oracle: "PERSONS(Q7251)" → "Q7251"
            const match = item.VERTEX_ID?.match(/\(([^)]+)\)/);
            return match ? match[1] : null;
        } else {
            // Memgraph: entity_id ist direkt die Wikidata ID
            return item['e.id'] || item.entity_id || null;
        }
    };

    // Daten-Tabelle für eine Entity
    const renderEntityTable = (entityData, source) => {
        // API Response ist: { success: true, data: { oracle: [...], memgraph: [...] } }
        let items = entityData?.data?.[source] || [];

        if (!Array.isArray(items) || items.length === 0) {
            return (
                <div className="text-gray-500 text-sm p-2">
                    Keine Daten verfügbar
                </div>
            );
        }

        // Sortierung nach Wikidata ID für bessere Vergleichbarkeit
        items = [...items].sort((a, b) => {
            const idA = extractWikidataId(a, source) || '';
            const idB = extractWikidataId(b, source) || '';
            return idA.localeCompare(idB);
        });

        // 2. NAME EXTRAKTION - Zeile ~200 ca.
        const getName = (item, source) => {
            let name = '';
            if (source === 'oracle') {
                name = item.NAME || 'Unbenannt';
            } else {
                // Memgraph: e.name für alle Entity-Typen
                name = item['e.name'] || item.name || 'Unbenannt';
            }

            // Intelligente Kapitalisierung anwenden
            return smartCapitalize(name);
        };

        // 3. PERSON DETAILS FÜR MEMGRAPH - Zeile ~240 ca.
        const getPersonDetails = (item, source) => {
            if (source === 'oracle') {
                return (
                    <div className="space-y-2">
                        <div className="grid grid-cols-1 gap-1 text-xs">
                            {item.BIRTH_DATE && (
                                <div className="flex items-center gap-1">
                                    <span className="text-green-600">🎂</span>
                                    <span className="font-medium">Geboren:</span>
                                    <span>{item.BIRTH_DATE.split(' ')[0]}</span>
                                </div>
                            )}
                            {item.DEATH_DATE && (
                                <div className="flex items-center gap-1">
                                    <span className="text-red-600">⚱️</span>
                                    <span className="font-medium">Gestorben:</span>
                                    <span>{item.DEATH_DATE.split(' ')[0]}</span>
                                </div>
                            )}
                            {item.GENDER && (
                                <div className="flex items-center gap-1">
                                    <span>{item.GENDER === 'Male' ? '👨' : item.GENDER === 'Female' ? '👩' : '👤'}</span>
                                    <span className="font-medium">Geschlecht:</span>
                                    <span>{item.GENDER}</span>
                                </div>
                            )}
                            {item.DESCRIPTION && (
                                <div className="flex items-start gap-1 mt-1">
                                    <span className="text-blue-600">📄</span>
                                    <div>
                                        <span className="font-medium">Beschreibung:</span>
                                        <div className="text-gray-600 mt-0.5">
                                            {sentenceCase(
                                                item.DESCRIPTION.length > 80
                                                    ? `${item.DESCRIPTION.substring(0, 80)}...`
                                                    : item.DESCRIPTION
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                            <div className="flex items-center gap-1 text-gray-400 mt-2 pt-1 border-t">
                                <span>🏢</span>
                                <span className="font-medium">Oracle ID:</span>
                                <span className="font-mono text-xs">{item.VERTEX_ID}</span>
                            </div>
                        </div>
                    </div>
                );
            } else {
                // MEMGRAPH - KORRIGIERTE FELDNAMEN!
                return (
                    <div className="space-y-2">
                        <div className="grid grid-cols-1 gap-1 text-xs">
                            {item['e.birth_date'] && (
                                <div className="flex items-center gap-1">
                                    <span className="text-green-600">🎂</span>
                                    <span className="font-medium">Geboren:</span>
                                    <span>{item['e.birth_date'].split(' ')[0]}</span>
                                </div>
                            )}
                            {item['e.death_date'] && (
                                <div className="flex items-center gap-1">
                                    <span className="text-red-600">⚱️</span>
                                    <span className="font-medium">Gestorben:</span>
                                    <span>{item['e.death_date'].split(' ')[0]}</span>
                                </div>
                            )}
                            {item['e.gender'] && (
                                <div className="flex items-center gap-1">
                                    <span>{item['e.gender'] === 'Male' ? '👨' : item['e.gender'] === 'Female' ? '👩' : '👤'}</span>
                                    <span className="font-medium">Geschlecht:</span>
                                    <span>{item['e.gender']}</span>
                                </div>
                            )}
                            {item['e.description'] && (
                                <div className="flex items-start gap-1 mt-1">
                                    <span className="text-blue-600">📄</span>
                                    <div>
                                        <span className="font-medium">Beschreibung:</span>
                                        <div className="text-gray-600 mt-0.5">
                                            {sentenceCase(
                                                item['e.description'].length > 80
                                                    ? `${item['e.description'].substring(0, 80)}...`
                                                    : item['e.description']
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                            <div className="flex items-center gap-1 text-gray-400 mt-2 pt-1 border-t">
                                <span>🔢</span>
                                <span className="font-medium">Memgraph ID:</span>
                                <span className="font-mono text-xs">{item.vertex_id}</span>
                            </div>
                        </div>
                    </div>
                );
            }
        };
        
        
        // Vereinfachte Details für andere Entity-Typen
        const getSimpleDetails = (item, source) => {
            return (
                <div className="space-y-1">
                    <div className="text-xs text-gray-400">
                        <div className="flex items-center gap-1">
                            <span>{source === 'oracle' ? '🏢' : '🔢'}</span>
                            <span className="font-medium">
                {source === 'oracle' ? 'Oracle ID:' : 'Memgraph ID:'}
              </span>
                            <span className="font-mono">
                {source === 'oracle' ? item.VERTEX_ID : item.vertex_id}
              </span>
                        </div>
                    </div>
                </div>
            );
        };

        // 4. PERSON ENTITY DETECTION - Zeile ~330 ca.
        const isPersonEntity = (item, source) => {
            if (source === 'oracle') {
                return item.BIRTH_DATE || item.DEATH_DATE || item.GENDER;
            } else {
                // MEMGRAPH - KORRIGIERTE FELDNAMEN!
                return item['e.name'] || item['e.birth_date'] || item['e.gender'];
            }
        };

        return (
            <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                    <thead>
                    <tr className="border-b">
                        <th className="text-left p-3 font-medium text-gray-700">Wikidata ID</th>
                        <th className="text-left p-3 font-medium text-gray-700">Name</th>
                        <th className="text-left p-3 font-medium text-gray-700">Details</th>
                    </tr>
                    </thead>
                    <tbody>
                    {items.slice(0, 50).map((item, idx) => {
                        const wikidataId = extractWikidataId(item, source);
                        return (
                            <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                                <td className="p-3 text-gray-600 text-xs font-mono bg-gray-50">
                                    {wikidataId ? (
                                        <a
                                            href={`https://www.wikidata.org/wiki/${wikidataId}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-blue-600 hover:underline"
                                        >
                                            {wikidataId}
                                        </a>
                                    ) : (
                                        <span className="text-gray-400">—</span>
                                    )}
                                </td>
                                <td className="p-3 font-medium text-gray-900">
                                    {getName(item, source)}
                                </td>
                                <td className="p-3 text-gray-500">
                                    {isPersonEntity(item, source)
                                        ? getPersonDetails(item, source)
                                        : getSimpleDetails(item, source)
                                    }
                                </td>
                            </tr>
                        );
                    })}
                    </tbody>
                </table>
                {items.length > 50 && (
                    <div className="text-xs text-gray-500 p-3 bg-gray-50 text-center">
                        <strong>... und {items.length - 50} weitere Einträge</strong>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="space-y-6">
            {/* Control Button */}
            <div className="flex items-center gap-4">
                <button
                    onClick={loadAllData}
                    disabled={loading}
                    className={`
            flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors
            ${loading
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800'
                    }
          `}
                >
                    <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                    {loading ? 'Lade Daten...' : 'Zeige gesamten Inhalt'}
                </button>

                {data && (
                    <div className="text-sm text-gray-600">
                        {Object.keys(data).length} Entity-Typen geladen
                    </div>
                )}
            </div>

            {/* Error Message */}
            {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded text-red-700">
                    ❌ Fehler beim Laden der Daten: {error}
                </div>
            )}

            {/* Data Display */}
            {data && (
                <div className="space-y-8">
                    {Object.entries(data).map(([entityType, entityData]) => (
                        <div key={entityType} className="border rounded-lg overflow-hidden">
                            {/* Entity Header */}
                            <div className="bg-gray-50 px-4 py-3 border-b">
                                <h3 className="font-semibold text-gray-900 flex items-center">
                                    {getEntityIcon(entityType)}
                                    {entityType.charAt(0).toUpperCase() + entityType.slice(1)}
                                    {entityData?.success === false && (
                                        <span className="ml-2 text-red-600 text-sm">❌ Fehler</span>
                                    )}
                                </h3>
                            </div>

                            {/* Oracle vs Memgraph Comparison */}
                            <div className="grid grid-cols-1 lg:grid-cols-2">
                                {/* Oracle Results */}
                                <div className="p-4 border-r lg:border-r border-b lg:border-b-0">
                                    <h4 className="font-medium text-red-700 mb-3 flex items-center">
                                        <Database size={16} className="mr-1" />
                                        Oracle ({(entityData?.data?.oracle || []).length})
                                    </h4>
                                    {renderEntityTable(entityData, 'oracle')}
                                </div>

                                {/* Memgraph Results */}
                                <div className="p-4">
                                    <h4 className="font-medium text-blue-700 mb-3 flex items-center">
                                        <Database size={16} className="mr-1" />
                                        Memgraph ({(entityData?.data?.memgraph || []).length})
                                    </h4>
                                    {renderEntityTable(entityData, 'memgraph')}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Loading State */}
            {loading && (
                <div className="text-center py-8">
                    <RefreshCw size={24} className="animate-spin mx-auto text-blue-600 mb-2" />
                    <p className="text-gray-600">Lade Daten von Oracle und Memgraph...</p>
                </div>
            )}
        </div>
    );
};

export default DataViewer;