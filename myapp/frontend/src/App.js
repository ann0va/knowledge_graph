import React from 'react';
import './App.css';
import HealthCheck from './components/HealthCheck';

function App() {
  return (
      <div className="min-h-screen bg-gray-100 p-4">
        <div className="max-w-6xl mx-auto">
          <header className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900">
              🔍 Knowledge Graph Explorer
            </h1>
            <p className="text-gray-600 mt-2">
              CRUD-Interface für Oracle & Memgraph Datenbanken
            </p>
          </header>

          <main>
            <div className="mb-6">
              <h2 className="text-xl font-semibold mb-4">🔗 Backend Verbindung</h2>
              <HealthCheck />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Oracle Results */}
              <div className="database-result oracle">
                <h3 className="font-bold text-red-800 mb-2">🔴 Oracle Database</h3>
                <div className="text-sm text-gray-600">
                  Oracle PGQL Ergebnisse werden hier angezeigt...
                </div>
              </div>

              {/* Memgraph Results */}
              <div className="database-result memgraph">
                <h3 className="font-bold text-blue-800 mb-2">🔵 Memgraph Database</h3>
                <div className="text-sm text-gray-600">
                  Memgraph Cypher Ergebnisse werden hier angezeigt...
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
  );
}

export default App;