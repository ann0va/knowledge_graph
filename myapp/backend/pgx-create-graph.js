// pgx-create-graph.js - Erstellt und lädt Graph auf PGX Server
require('dotenv').config();
const fs = require('fs').promises;
const axios = require('axios');
const https = require('https');

const base = process.env.PGX_URL.replace(/\/+$/, '');
const httpsAgent = new https.Agent({ rejectUnauthorized: false });

async function getToken() {
    const { data } = await axios.post(
        `${base}/auth/token`,
        {
            username: process.env.PGX_USER,
            password: process.env.PGX_PASS,
            createSession: true
        },
        { httpsAgent }
    );
    return data.access_token;
}

async function createGraphFromJson(jsonFile) {
    console.log('🌐 PGX Graph Creator\n');

    try {
        // JSON laden
        console.log(`📖 Lade ${jsonFile}...`);
        const jsonContent = await fs.readFile(jsonFile, 'utf8');
        const graphData = JSON.parse(jsonContent);

        // Token holen
        console.log('🔑 Authentifiziere...');
        const token = await getToken();
        const headers = { Authorization: `Bearer ${token}` };

        // 1. Prüfe ob Graph existiert
        console.log(`\n1️⃣  Prüfe ob Graph "${graphData.graph_name}" existiert...`);
        try {
            const listResp = await axios.get(
                `${base}/v2/graphs?driver=GRAPH_SERVER_PGX`,
                { httpsAgent, headers }
            );

            const existingGraph = listResp.data.find(g => g.graphName === graphData.graph_name);

            if (existingGraph) {
                console.log('   ⚠️  Graph existiert bereits!');
                console.log(`   Vertices: ${existingGraph.vertexCount}, Edges: ${existingGraph.edgeCount}`);

                // Optional: Graph löschen
                console.log('\n   🗑️  Lösche alten Graph...');
                await axios.delete(
                    `${base}/v2/graphs/${graphData.graph_name}?driver=GRAPH_SERVER_PGX`,
                    { httpsAgent, headers }
                );
                console.log('   ✅ Graph gelöscht');
            }
        } catch (e) {
            console.log('   ℹ️  Graph existiert noch nicht');
        }

        // 2. Graph erstellen
        console.log(`\n2️⃣  Erstelle neuen Graph "${graphData.graph_name}"...`);

        // Format für PGX v2 API
        const createRequest = {
            graphName: graphData.graph_name,
            vertexProviders: [
                {
                    name: "vertices",
                    format: "json",
                    data: graphData.vertices.map(v => ({
                        id: v.id,
                        labels: v.labels,
                        ...v.properties
                    }))
                }
            ],
            edgeProviders: [
                {
                    name: "edges",
                    format: "json",
                    data: graphData.edges.map(e => ({
                        id: e.id,
                        source: e.source,
                        target: e.target,
                        label: e.label,
                        ...e.properties
                    }))
                }
            ]
        };

        try {
            const createResp = await axios.post(
                `${base}/v2/graphs?driver=GRAPH_SERVER_PGX`,
                createRequest,
                { httpsAgent, headers }
            );

            console.log('   ✅ Graph erfolgreich erstellt!');
            console.log(`   Response:`, createResp.data);

        } catch (e) {
            console.error('   ❌ Fehler beim Erstellen:', e.response?.data || e.message);

            // Alternative: Vereinfachte Struktur versuchen
            console.log('\n   🔄 Versuche alternative Methode...');

            // Schreibe temporäre Dateien
            const vertexFile = 'temp_vertices.json';
            const edgeFile = 'temp_edges.json';

            await fs.writeFile(vertexFile, JSON.stringify(graphData.vertices, null, 2));
            await fs.writeFile(edgeFile, JSON.stringify(graphData.edges, null, 2));

            console.log('   📝 Temporäre Dateien erstellt');
            console.log(`   - ${vertexFile}: ${graphData.vertices.length} vertices`);
            console.log(`   - ${edgeFile}: ${graphData.edges.length} edges`);

            throw new Error('Automatisches Laden fehlgeschlagen. Bitte manuell über Dashboard hochladen.');
        }

        // 3. Graph testen
        console.log('\n3️⃣  Teste neuen Graph...');

        const testQuery = `SELECT COUNT(*) FROM MATCH (v)`;
        const testResp = await axios.post(
            `${base}/v2/runQuery`,
            {
                statements: [testQuery],
                driver: 'GRAPH_SERVER_PGX',
                graphName: graphData.graph_name,
                formatter: 'DATASTUDIO'
            },
            { httpsAgent, headers }
        );

        console.log(`   ✅ Graph enthält ${testResp.data.results[0].result} Vertices`);

    } catch (error) {
        console.error('\n❌ Fehler:', error.message);

        console.log('\n📝 Alternative: Manueller Upload');
        console.log('1. Öffnen Sie: ' + base + '/ui');
        console.log('2. Navigieren Sie zu "Graphs" → "Create Graph"');
        console.log('3. Wählen Sie "Upload from file"');
        console.log('4. Laden Sie knowledge-graph-pgx.json hoch');
    }
}

// Script ausführen
if (require.main === module) {
    const jsonFile = process.argv[2] || 'knowledge-graph-pgx.json';

    createGraphFromJson(jsonFile)
        .then(() => console.log('\n✅ Abgeschlossen'))
        .catch(console.error);
}

module.exports = { createGraphFromJson };