// src/components/HealthCheck.js - Kompakte Version
import React, { useState, useEffect } from 'react';
import { Database, Wifi, WifiOff } from 'lucide-react';
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
            <div className="flex items-center gap-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-yellow-600 border-t-transparent"></div>
                <span className="text-yellow-800 text-sm font-medium">Verbinde zum Backend...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                <WifiOff className="text-red-600" size={20} />
                <div className="flex-1">
                    <span className="text-red-800 text-sm font-medium">Backend nicht erreichbar</span>
                    <div className="text-xs text-red-600">http://c017-master.infcs.de:10510/api</div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex items-center gap-6 p-3 bg-green-50 border border-green-200 rounded-lg">
            {/* Backend Status */}
            <div className="flex items-center gap-2">
                <Wifi className="text-green-600" size={20} />
                <span className="text-green-800 text-sm font-medium">Backend verbunden</span>
            </div>

            {/* Database Status */}
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-1">
                    <Database className="text-red-600" size={16} />
                    <span className="text-sm">Oracle:</span>
                    <span className={`text-xs font-medium ${health.databases?.oracle ? 'text-green-600' : 'text-red-600'}`}>
                        {health.databases?.oracle ? '✅' : '❌'}
                    </span>
                </div>

                <div className="flex items-center gap-1">
                    <Database className="text-blue-600" size={16} />
                    <span className="text-sm">Memgraph:</span>
                    <span className={`text-xs font-medium ${health.databases?.memgraph ? 'text-green-600' : 'text-red-600'}`}>
                        {health.databases?.memgraph ? '✅' : '❌'}
                    </span>
                </div>
            </div>

            {/* Server Info */}
            <div className="text-xs text-gray-500">
                {health.server}
            </div>
        </div>
    );
};

export default HealthCheck;