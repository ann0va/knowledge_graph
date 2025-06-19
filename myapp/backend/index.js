// index.js - Aktualisierte Version
const path = require('path');
const express = require('express');
const cors = require('cors');
const { initializeOraclePool, closeOraclePool, closeMemgraphDriver } = require('./src/config/database');
const DataController = require('./src/controllers/DataController');
const errorHandler = require('./src/middleware/errorHandler');

const app = express();
const dataController = new DataController();

// Middleware
app.use(express.json());
app.use(cors()); // CORS für Frontend-Zugriff

// Static files für React Frontend
const buildPath = path.join(__dirname, '../frontend/build');
app.use(express.static(buildPath));

// API Routes
const apiRouter = express.Router();

// CRUD Endpunkte
apiRouter.post('/create', (req, res, next) => dataController.create(req, res, next));
apiRouter.post('/read', (req, res, next) => dataController.read(req, res, next));
apiRouter.put('/update/:id', (req, res, next) => dataController.update(req, res, next));
apiRouter.delete('/delete/:id', (req, res, next) => dataController.delete(req, res, next));

// Universelle Query-Schnittstelle
apiRouter.post('/query', (req, res, next) => dataController.query(req, res, next));

// Direkte Query-Ausführung (für fortgeschrittene Nutzer)
apiRouter.post('/execute', (req, res, next) => dataController.executeQuery(req, res, next));

// Health Check
apiRouter.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        databases: ['oracle', 'memgraph'],
        timestamp: new Date().toISOString()
    });
});

// Mount API routes
app.use('/api', apiRouter);

// Catch-all für React Router
// app.get('/*', (req, res) => {
//     res.sendFile(path.join(buildPath, 'index.html'));
// });

app.get('/*splat', (req, res) => {
    res.sendFile(path.join(buildPath, 'index.html'));
});

// Error Handler (muss als letztes kommen)
app.use(errorHandler);

// Server starten
const PORT = process.env.PORT || 10510;

async function startServer() {
    try {
        // Oracle Pool initialisieren
        await initializeOraclePool();

        const server = app.listen(PORT, () => {
            console.log(`Backend läuft auf Port ${PORT}`);
            console.log('Verfügbare Datenbanken: Oracle, Memgraph');
        });

        // Graceful Shutdown
        process.on('SIGTERM', async () => {
            console.log('SIGTERM empfangen. Server wird heruntergefahren...');

            server.close(async () => {
                await closeOraclePool();
                await closeMemgraphDriver();
                console.log('Server beendet');
                process.exit(0);
            });
        });

    } catch (error) {
        console.error('Fehler beim Starten des Servers:', error);
        process.exit(1);
    }
}

startServer();