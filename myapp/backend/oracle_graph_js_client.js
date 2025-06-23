// Oracle Graph REST API v2 Client - EXAKT nach Spezifikation
const axios = require('axios');
require('dotenv').config();

class OracleGraphRESTv2Client {
    constructor() {
        this.baseUrl = process.env.PGX_URL || 'https://c017-node3.infcs.de:7007';
        this.username = process.env.PGX_USER || 'team25s5';
        this.password = process.env.PGX_PASS || 'team25s5.c017';
        this.token = null;

        // HTTP Agent für SSL
        this.httpsAgent = new (require('https')).Agent({
            rejectUnauthorized: false
        });
    }

    // Authentication Token holen - EXAKT nach API v2
    async authenticate() {
        try {
            console.log('🔐 Getting authentication token...');

            const response = await axios.post(`${this.baseUrl}/auth/token`, {
                username: this.username,
                password: this.password,
                createSession: true  // Wichtig für PGQL Queries!
            }, {
                headers: {
                    'Accept': 'application/json; charset=UTF-8',
                    'Content-Type': 'application/json'
                },
                httpsAgent: this.httpsAgent
            });

            this.token = response.data.access_token;
            const expiresIn = response.data.expires_in;

            console.log(`✅ Token erhalten (expires in ${expiresIn}s)`);
            return true;

        } catch (error) {
            console.error('❌ Authentication failed:', {
                status: error.response?.status,
                statusText: error.response?.statusText,
                data: error.response?.data,
                message: error.message
            });
            return false;
        }
    }

    // Graphs auflisten - API v2
    async getGraphs(driver = 'PGQL_IN_DATABASE') {
        try {
            console.log(`🔍 Getting graphs (driver: ${driver})...`);

            const response = await axios.get(`${this.baseUrl}/v2/graphs`, {
                headers: {
                    'Accept': 'application/json; charset=UTF-8',
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                },
                params: {
                    driver: driver  // GRAPH_SERVER_PGX, PGQL_IN_DATABASE, SQL_IN_DATABASE
                },
                httpsAgent: this.httpsAgent
            });

            console.log('✅ Graphs retrieved');
            return response.data;

        } catch (error) {
            console.error('❌ Get graphs failed:', error.response?.data || error.message);
            return [];
        }
    }

    // PGQL Query ausführen - API v2
    async runPGQLQuery(statements, driver = 'PGQL_IN_DATABASE') {
        try {
            console.log('🔍 Running PGQL query...');
            console.log('Statements:', statements);

            const response = await axios.post(`${this.baseUrl}/v2/runQuery`, {
                statements: Array.isArray(statements) ? statements : [statements],
                driver: driver,
                formatter: 'GVT',  // Graph Visualization Tool format
                parameters: {
                    dynamicSampling: 2,
                    parallel: 8,
                    start: 0,
                    size: 100
                },
                visualize: true
            }, {
                headers: {
                    'Accept': 'application/json; charset=UTF-8',
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                },
                httpsAgent: this.httpsAgent
            });

            console.log('✅ PGQL query executed');
            return response.data;

        } catch (error) {
            console.error('❌ PGQL query failed:', error.response?.data || error.message);
            return null;
        }
    }

    // Async PGQL Query - für längere Operationen
    async runPGQLQueryAsync(statements, driver = 'PGQL_IN_DATABASE') {
        try {
            console.log('🔍 Starting async PGQL query...');

            const response = await axios.post(`${this.baseUrl}/v2/runQueryAsync`, {
                statements: Array.isArray(statements) ? statements : [statements],
                driver: driver,
                formatter: 'GVT',
                parameters: {
                    dynamicSampling: 2,
                    parallel: 8,
                    start: 0,
                    size: 100
                },
                visualize: true
            }, {
                headers: {
                    'Accept': 'application/json; charset=UTF-8',
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                },
                httpsAgent: this.httpsAgent
            });

            const resultId = response.data.result_id;
            console.log(`✅ Async query started (result_id: ${resultId})`);

            // Warten bis fertig
            return await this.waitForAsyncResult(resultId);

        } catch (error) {
            console.error('❌ Async PGQL query failed:', error.response?.data || error.message);
            return null;
        }
    }

    // Auf Async Ergebnis warten
    async waitForAsyncResult(resultId, maxWaitTime = 60000) {
        const startTime = Date.now();

        while (Date.now() - startTime < maxWaitTime) {
            try {
                // Prüfen ob fertig
                const checkResponse = await axios.get(
                    `${this.baseUrl}/v2/isAsyncQueryExecutionComplete/${resultId}`,
                    {
                        headers: {
                            'Accept': 'application/json; charset=UTF-8',
                            'Authorization': `Bearer ${this.token}`,
                            'Content-Type': 'application/json'
                        },
                        httpsAgent: this.httpsAgent
                    }
                );

                if (checkResponse.data === true) {
                    // Ergebnis holen
                    const resultResponse = await axios.get(
                        `${this.baseUrl}/v2/runQueryAsync/${resultId}`,
                        {
                            headers: {
                                'Accept': 'application/json; charset=UTF-8',
                                'Authorization': `Bearer ${this.token}`,
                                'Content-Type': 'application/json'
                            },
                            httpsAgent: this.httpsAgent
                        }
                    );

                    console.log('✅ Async query completed');
                    return resultResponse.data;
                }

                // 2 Sekunden warten
                await new Promise(resolve => setTimeout(resolve, 2000));

            } catch (error) {
                console.error('❌ Error checking async result:', error.message);
                break;
            }
        }

        console.error('❌ Async query timeout');
        return null;
    }

    // User Info abrufen
    async getUser() {
        try {
            const response = await axios.get(`${this.baseUrl}/v2/user`, {
                headers: {
                    'Accept': 'application/json; charset=UTF-8',
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                },
                httpsAgent: this.httpsAgent
            });

            return response.data.username;

        } catch (error) {
            console.error('❌ Get user failed:', error.message);
            return null;
        }
    }

    // Database Version abrufen
    async getDBVersion() {
        try {
            const response = await axios.get(`${this.baseUrl}/v2/dbVersion`, {
                headers: {
                    'Accept': 'application/json; charset=UTF-8',
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                },
                httpsAgent: this.httpsAgent
            });

            return response.data.dbVersion;

        } catch (error) {
            console.error('❌ Get DB version failed:', error.message);
            return null;
        }
    }

    // Visualization Data aus PGQL Ergebnis extrahieren
    extractVisualizationData(pgqlResult) {
        if (!pgqlResult || !pgqlResult.results) return { vertices: [], edges: [] };

        const vertices = [];
        const edges = [];

        pgqlResult.results.forEach(result => {
            if (result.success && result.result) {
                try {
                    const data = JSON.parse(result.result);
                    if (data.graph) {
                        if (data.graph.vertices) {
                            vertices.push(...data.graph.vertices);
                        }
                        if (data.graph.edges) {
                            edges.push(...data.graph.edges);
                        }
                    }
                } catch (e) {
                    console.warn('Could not parse result as JSON:', e.message);
                }
            }
        });

        return { vertices, edges };
    }
}

// Test-Funktionen
async function testOracleGraphAPI() {
    console.log('🚀 Oracle Graph REST API v2 Test\n');

    const client = new OracleGraphRESTv2Client();

    try {
        // 1. Authentifizieren
        if (!await client.authenticate()) {
            return;
        }

        // 2. User Info
        const user = await client.getUser();
        console.log(`👤 Current user: ${user}`);

        // 3. DB Version
        const dbVersion = await client.getDBVersion();
        console.log(`🗄️ Database version: ${dbVersion}`);

        // 4. Graphs auflisten
        console.log('\n📊 Available graphs:');
        const graphs = await client.getGraphs('PGQL_IN_DATABASE');
        console.table(graphs);

        // 5. PGQL Queries testen - FIXED
        const testQueries = [
            "SELECT COUNT(*) as total_count FROM MATCH (n) ON WORKED_AT_GRAPH",
            "SELECT n.name FROM MATCH (n:Person) ON WORKED_AT_GRAPH LIMIT 5",
            "SELECT p.name as person_name, w.name as workplace_name FROM MATCH (p:Person) -[:WORKED_AT]-> (w:Workplace) ON WORKED_AT_GRAPH LIMIT 3"
        ];

        for (const query of testQueries) {
            console.log(`\n🔍 Testing: ${query}`);
            const result = await client.runPGQLQuery(query);

            if (result && result.results) {
                result.results.forEach(r => {
                    if (r.success) {
                        console.log('✅ Success:', r.result);
                    } else {
                        console.log('❌ Error:', r.error);
                    }
                });
            }
        }

        console.log('\n🎉 Oracle Graph REST API v2 Test completed!');

    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
    }
}

// Express Server
const express = require('express');
const app = express();
app.use(express.json());

let graphClient = null;

async function ensureClient() {
    if (!graphClient) {
        graphClient = new OracleGraphRESTv2Client();
        await graphClient.authenticate();
    }
    return graphClient;
}

// API Endpoints
app.post('/api/pgql', async (req, res) => {
    try {
        const client = await ensureClient();
        const { query, driver = 'PGQL_IN_DATABASE' } = req.body;

        const result = await client.runPGQLQuery(query, driver);
        res.json({ success: true, data: result });

    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/graphs', async (req, res) => {
    try {
        const client = await ensureClient();
        const { driver = 'PGQL_IN_DATABASE' } = req.query;

        const graphs = await client.getGraphs(driver);
        res.json(graphs);

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/visualization', async (req, res) => {
    try {
        const client = await ensureClient();
        const driver = req.query.driver || 'PGQL_IN_DATABASE';

        // Sample query für Visualization - FIXED
        const result = await client.runPGQLQuery([
            "SELECT * FROM MATCH (v) ON WORKED_AT_GRAPH LIMIT 50",
            "SELECT * FROM MATCH (v1) -[e]-> (v2) ON WORKED_AT_GRAPH LIMIT 50"
        ], driver);

        const vizData = client.extractVisualizationData(result);
        res.json(vizData);

    } catch (error) {
        res.status(500).json({ vertices: [], edges: [] });
    }
});

app.get('/api/visualization/:driver', async (req, res) => {
    try {
        const client = await ensureClient();
        const driver = req.params.driver;

        // Sample query für Visualization - FIXED
        const result = await client.runPGQLQuery([
            "SELECT * FROM MATCH (v) ON WORKED_AT_GRAPH LIMIT 50",
            "SELECT * FROM MATCH (v1) -[e]-> (v2) ON WORKED_AT_GRAPH LIMIT 50"
        ], driver);

        const vizData = client.extractVisualizationData(result);
        res.json(vizData);

    } catch (error) {
        res.status(500).json({ vertices: [], edges: [] });
    }
});

module.exports = { OracleGraphRESTv2Client };

// Test ausführen
if (require.main === module) {
    if (process.argv.includes('--server')) {
        const PORT = process.env.PORT || 3000;
        app.listen(PORT, () => {
            console.log(`🚀 Oracle Graph REST API v2 Server auf Port ${PORT}`);
        });
    } else {
        testOracleGraphAPI();
    }
}