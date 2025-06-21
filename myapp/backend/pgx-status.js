// pgx-status.js - Prüft PGX Server Status und Capabilities
require('dotenv').config();
const { listGraphs, runPgql } = require('./src/services/pgxService');
const axios = require('axios');
const https = require('https');

const base = process.env.PGX_URL.replace(/\/+$/, '');
const httpsAgent = new https.Agent({ rejectUnauthorized: false });

async function checkPGXStatus() {
    console.log('🔍 PGX Server Status Check\n');
    console.log(`Server: ${base}`);
    console.log(`User: ${process.env.PGX_USER}\n`);

    try {
        // 1. Graph Liste
        console.log('1️⃣  Verfügbare Graphs:');
        const graphs = await listGraphs();
        if (graphs && graphs.length > 0) {
            graphs.forEach(g => {
                console.log(`   • ${g.graphName || '(unnamed)'}`);
                if (g.vertexCount !== undefined) {
                    console.log(`     Vertices: ${g.vertexCount}, Edges: ${g.edgeCount}`);
                }
            });
        } else {
            console.log('   ❌ Keine Graphs gefunden');
        }

        // 2. Aktueller Graph
        console.log(`\n2️⃣  Aktueller Graph: ${process.env.GRAPH_NAME}`);
        try {
            const result = await runPgql('SELECT COUNT(*) FROM MATCH (v)');
            console.log(`   ✅ Graph existiert`);
            console.log(`   Vertices: ${result}`);
        } catch (e) {
            console.log(`   ❌ Graph nicht gefunden oder leer`);
            console.log(`   Fehler: ${e.message}`);
        }

        // 3. Capabilities
        console.log('\n3️⃣  Server Capabilities:');
        try {
            // Token holen
            const tokenResp = await axios.post(
                `${base}/auth/token`,
                {
                    username: process.env.PGX_USER,
                    password: process.env.PGX_PASS,
                    createSession: true
                },
                { httpsAgent }
            );
            const token = tokenResp.data.access_token;

            // Info endpoint
            const infoResp = await axios.get(
                `${base}/info`,
                {
                    httpsAgent,
                    headers: { Authorization: `Bearer ${token}` }
                }
            );
            console.log(`   Version: ${infoResp.data.version || 'unknown'}`);
            console.log(`   API Version: v2`);
        } catch (e) {
            console.log(`   ℹ️  Info nicht abrufbar`);
        }

    } catch (error) {
        console.error('❌ Fehler:', error.message);
    }
}

// Ausführen
checkPGXStatus()
    .then(() => console.log('\n✅ Status-Check abgeschlossen'))
    .catch(console.error);