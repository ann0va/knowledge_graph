import React from 'react';
import './App.css';
import HealthCheck from './components/HealthCheck';
import QueryBuilder from './components/QueryBuilder';

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
            {/* Compact Backend Health Check */}
            <section>
              <HealthCheck />
            </section>

            {/* Query Builder with integrated Data Viewer */}
            <section>
              <QueryBuilder />
            </section>
          </main>
        </div>
      </div>
  );
}

export default App;