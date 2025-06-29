// =============================================================================
// 2. 📁 src/components/query/shared/EntityDropdown.js - REUSABLE DROPDOWN
// 

import React, { useState, useEffect } from 'react';
import { QueryInterface } from './QueryInterface';

const EntityDropdown = ({
                            value,
                            onChange,
                            entityType,
                            placeholder,
                            className = "",
                            disabled = false
                        }) => {
    const [entities, setEntities] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const queryInterface = new QueryInterface();

    useEffect(() => {
        const loadEntities = async () => {
            setLoading(true);
            setError(null);
            try {
                const entityList = await queryInterface.loadEntitiesForDropdown(entityType);
                setEntities(entityList);
            } catch (err) {
                setError(err.message);
                setEntities([]);
            } finally {
                setLoading(false);
            }
        };
        loadEntities();
    }, [entityType]);

    return (
        <div className="space-y-2">
            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 ${className}`}
                disabled={loading || disabled}
            >
                <option value="">
                    {loading ? 'Laden...' : error ? 'Fehler beim Laden' : placeholder}
                </option>
                {entities.map((entity, idx) => (
                    <option key={idx} value={entity}>{entity}</option>
                ))}
            </select>

            {loading && (
                <div className="flex items-center text-sm text-gray-500">
                    <div className="animate-spin rounded-full h-3 w-3 border-2 border-blue-600 border-t-transparent mr-2"></div>
                    Entities werden geladen...
                </div>
            )}

            {error && (
                <div className="text-sm text-red-600">
                    ⚠️ Fehler: {error}
                </div>
            )}
        </div>
    );
};

export default EntityDropdown;
