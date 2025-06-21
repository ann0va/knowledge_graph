// index.js - Hauptserver mit Property Graph Support
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { initializeOraclePool, getOracleConnection } = require('./src/config/database');
const MemgraphRepository = require('./src/repositories/MemgraphRepository');
const RepositoryFactory = require('./src/repositories');

const app = express();
const PORT = process.env.PORT || 10510;

// Middleware
app.use(cors());
app.use(express.json());

// Globale Variablen für Repositories
let repositoryFactory;
let memgraphDb;

// Server initialisieren
async function initializeServer() {
    try {
        console.log('🚀 Initialisiere Server...\n');

        // Oracle Pool initialisieren
        console.log('📦 Initialisiere Oracle Connection Pool...');
        await initializeOraclePool();
        console.log('✅ Oracle Pool bereit\n');

        // Memgraph verbinden
        console.log('🔗 Verbinde zu Memgraph...');
        memgraphDb = new MemgraphRepository();
        await memgraphDb.connect();
        console.log('✅ Memgraph verbunden\n');

        // Repository Factory erstellen
        console.log('🏭 Erstelle Repository Factory...');
        repositoryFactory = new RepositoryFactory(
            { getConnection: getOracleConnection }, // Oracle adapter
            memgraphDb
        );
        console.log('✅ Repository Factory bereit\n');

        // Routes einbinden
        setupRoutes();

        // Server starten
        app.listen(PORT, () => {
            console.log(`✅ Server läuft auf http://c017-master.infcs.de:${PORT}`);
            console.log('\n📍 Verfügbare Endpoints:');
            console.log('   - GET  /api/health');
            console.log('   - GET  /api/person');
            console.log('   - GET  /api/person/:id');
            console.log('   - GET  /api/person/:id/relationships');
            console.log('   - POST /api/person');
            console.log('   - GET  /api/place');
            console.log('   - GET  /api/work');
            console.log('   - GET  /api/award');
            console.log('   - GET  /api/workplace');
            console.log('   - GET  /api/field');
            console.log('   - GET  /api/occupation');
            console.log('   - POST /api/query');
        });

    } catch (error) {
        console.error('❌ Fehler beim Server-Start:', error);
        process.exit(1);
    }
}

// Routes einrichten
function setupRoutes() {
    // Health Check
    app.get('/api/health', async (req, res) => {
        try {
            const health = {
                status: 'ok',
                timestamp: new Date().toISOString(),
                databases: {
                    oracle: false,
                    memgraph: false
                }
            };

            // Oracle Check
            try {
                const oracleRepo = repositoryFactory.getRepository('person', 'oracle');
                await oracleRepo.findAll(1);
                health.databases.oracle = true;
            } catch (e) {
                console.error('Oracle health check failed:', e.message);
            }

            // Memgraph Check
            try {
                const memgraphRepo = repositoryFactory.getRepository('person', 'memgraph');
                await memgraphRepo.findAll(1);
                health.databases.memgraph = true;
            } catch (e) {
                console.error('Memgraph health check failed:', e.message);
            }

            res.json(health);
        } catch (error) {
            res.status(500).json({
                status: 'error',
                error: error.message
            });
        }
    });

    // Entity Routes
    app.use('/api/person', require('./src/routes/person')(repositoryFactory));
    app.use('/api/place', require('./src/routes/place')(repositoryFactory));
    app.use('/api/work', require('./src/routes/work')(repositoryFactory));
    app.use('/api/award', require('./src/routes/award')(repositoryFactory));
    app.use('/api/workplace', require('./src/routes/workplace')(repositoryFactory));
    app.use('/api/field', require('./src/routes/field')(repositoryFactory));
    app.use('/api/occupation', require('./src/routes/occupation')(repositoryFactory));

    // Query Route (für direkte Cypher/SQL Queries)
    app.use('/api/query', require('./src/routes/query')(repositoryFactory));

    // 404 Handler
    app.use((req, res) => {
        res.status(404).json({
            success: false,
            error: 'Endpoint nicht gefunden'
        });
    });

    // Error Handler
    app.use((err, req, res, next) => {
        console.error('Server Error:', err);
        res.status(500).json({
            success: false,
            error: err.message || 'Interner Serverfehler'
        });
    });
}

// Graceful Shutdown
process.on('SIGINT', async () => {
    console.log('\n⏹️  Fahre Server herunter...');

    if (memgraphDb) {
        await memgraphDb.close();
        console.log('✅ Memgraph Verbindung geschlossen');
    }

    // Oracle Pool wird automatisch geschlossen

    process.exit(0);
});

// Server starten
initializeServer();