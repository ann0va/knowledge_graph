// src/components/HealthCheck.js - Backend Verbindung testen
import React, { useState, useEffect } from 'react';
import apiService from '../services/api';

const HealthCheck = () => {
    const [health, setHealth] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const checkHealth = async () => {
            try {
                setLoading(true);
                const healthData = await apiService.health();
                setHealth(healthData);
                setError(null);
            } catch (err) {
                setError(err.message);
                setHealth(null);
            } finally {
                setLoading(false);
            }
        };

        checkHealth();
    }, []);

    if (loading) {
        return (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded">
                🔄 Verbinde zum Backend...
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-4 bg-red-50 border border-red-200 rounded">
                ❌ Backend-Verbindung fehlgeschlagen: {error}
                <div className="text-sm text-gray-600 mt-2">
                    Backend URL: http://c017-master.infcs.de:10510/api
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 bg-green-50 border border-green-200 rounded">
            <h3 className="font-bold text-green-800">✅ Backend verbunden!</h3>
            <div className="mt-2 text-sm">
                <div>Status: {health.status}</div>
                <div>Server: {health.server}</div>
                <div className="mt-2">
                    <strong>Datenbanken:</strong>
                    <ul className="ml-4">
                        <li>Oracle: {health.databases?.oracle ? '✅' : '❌'}</li>
                        <li>Memgraph: {health.databases?.memgraph ? '✅' : '❌'}</li>
                    </ul>
                </div>
            </div>
        </div>
    );
};

export default HealthCheck;