import React from 'react';
import './App.css';
import HealthCheck from './components/HealthCheck';
import DataViewer from './components/DataViewer';

function App() {
  return (
      <div className="min-h-screen bg-gray-100 p-4">
        <div className="max-w-7xl mx-auto">
          <header className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900">
              🔍 Knowledge Graph Explorer
            </h1>
            <p className="text-gray-600 mt-2">
              CRUD-Interface für Oracle & Memgraph Datenbanken
            </p>
          </header>

          <main className="space-y-8">
            {/* Backend Health Check */}
            <section>
              <h2 className="text-xl font-semibold mb-4">🔗 Backend Verbindung</h2>
              <HealthCheck />
            </section>

            {/* Data Viewer */}
            <section>
              <h2 className="text-xl font-semibold mb-4">📊 Datenbank Inhalt</h2>
              <DataViewer />
            </section>
          </main>
        </div>
      </div>
  );
}

export default App;