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
            console.log('   === Health & Status ===');
            console.log('   - GET  /api/health');
            console.log('');
            console.log('');
            console.log('\n🎯 Quick Start:');
            console.log(`   curl http://c017-master.infcs.de:${PORT}/api/graph/health`);
        });

    } catch (error) {
        console.error('❌ Fehler beim Server-Start:', error);
        process.exit(1);
    }
}

// Routes einrichten
function setupRoutes() {
    // Health Check - Erweitert für EntityRepository
    app.get('/api/health', async (req, res) => {
        try {
            const health = {
                status: 'ok',
                timestamp: new Date().toISOString(),
                server: 'Unified Backend',
                databases: {
                    oracle: false,
                    memgraph: false,
                    propertyGraph: false
                },
                entityRepositories: {},
                availableEntityTypes: repositoryFactory.getAvailableEntityTypes(),
                availableRelationshipTypes: repositoryFactory.getAvailableRelationshipTypes()
            };

            // Oracle Check mit EntityRepository
            try {
                const oracleRepo = repositoryFactory.getRepository('person', 'oracle');
                const result = await oracleRepo.findAll(1);
                health.databases.oracle = true;
                health.databases.oracleTestResult = result.length;
            } catch (e) {
                console.error('Oracle health check failed:', e.message);
                health.databases.oracleError = e.message;
            }

            // Memgraph Check mit EntityRepository
            try {
                const memgraphRepo = repositoryFactory.getRepository('person', 'memgraph');
                const result = await memgraphRepo.findAll(1);
                health.databases.memgraph = true;
                health.databases.memgraphTestResult = result.length;
            } catch (e) {
                console.error('Memgraph health check failed:', e.message);
                health.databases.memgraphError = e.message;
            }

            // Property Graph Check (unverändert)
            try {
                const PropertyGraphService = require('./src/services/PropertyGraphService');
                const pgService = new PropertyGraphService();
                await pgService.authenticate();
                const graphs = await pgService.listGraphs();
                health.databases.propertyGraph = true;
                health.databases.availableGraphs = graphs.length;
            } catch (e) {
                console.error('Property Graph health check failed:', e.message);
                health.databases.propertyGraphError = e.message;
            }

            // Alle Entity-Repositories testen (optional, nur wenn gewünscht)
            if (req.query.detailed === 'true') {
                try {
                    health.entityRepositories = await repositoryFactory.healthCheckAll();
                } catch (e) {
                    health.entityRepositoriesError = e.message;
                }
            }

            res.json(health);
        } catch (error) {
            res.status(500).json({
                status: 'error',
                error: error.message
            });
        }
    });

    // === NEUE UNIVERSAL ENTITY ROUTE ===
    app.use('/api/entity', require('./src/routes/entity')(repositoryFactory));

    // === PROPERTY GRAPH ROUTES (unverändert) ===
    app.use('/api/graph', require('./src/routes/graph')(repositoryFactory));

    // === QUERY ROUTES (bestehende) ===
    app.use('/api/query', require('./src/routes/query')(repositoryFactory));

    // === ROOT INFO ===
    app.get('/', (req, res) => {
        res.json({
            name: 'Unified Backend API',
            version: '1.0.0',
            description: 'Unified API for Memgraph and Oracle Property Graphs',
            endpoints: {
                health: '/api/health',
                propertyGraphs: '/api/graph/*',
                entities: '/api/{person|place|work|award|workplace|field|occupation}',
                directQueries: '/api/query'
            },
            documentation: {
                propertyGraphManagement: {
                    create: 'POST /api/graph/create',
                    list: 'GET /api/graph/list',
                    stats: 'GET /api/graph/{name}/stats',
                    visualization: 'GET /api/graph/{name}/visualization',
                    customQuery: 'POST /api/graph/{name}/query'
                }
            }
        });
    });

    // === ERROR HANDLERS ===
    // 404 Handler
    app.use((req, res) => {
        res.status(404).json({
            success: false,
            error: 'Endpoint nicht gefunden'
        });
    });

    // Global Error Handler
    app.use((err, req, res, next) => {
        console.error('Server Error:', err);
        res.status(500).json({
            success: false,
            error: err.message || 'Interner Serverfehler',
            timestamp: new Date().toISOString()
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
    console.log('✅ Oracle Pool geschlossen');

    console.log('👋 Server erfolgreich heruntergefahren');
    process.exit(0);
});

// Server starten
initializeServer();