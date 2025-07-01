// src/services/pgxService.js (v2-kompatibel)
require('dotenv').config();
const axios = require('axios');
const https = require('https');
const {throwErr} = require("oracledb/lib/errors");

const base = process.env.PGX_URL.replace(/\/+$/, '');
const httpsAgent = new https.Agent({rejectUnauthorized: false});

/* -------- Token -------- */
let tokenData = null;               // { access_token, expires_in }

async function getToken() {
    const {data} = await axios.post(
        `${base}/auth/token`,
        {
            username: process.env.PGX_USER,
            password: process.env.PGX_PASS,
            createSession: true,
            source: 'nodejs'
        },
        {httpsAgent}
    );
    tokenData = data;                 // merken
}

async function ensureToken() {
    if (!tokenData) return getToken();                     // noch keiner da
    const now = Date.now() / 1000;
    if (now > tokenData.expires_in - 60) {                 // kurz vorm Ablaufen
        try {                                                // versuchen Refresh
            const {data} = await axios.put(
                `${base}/auth/token`,
                {token: tokenData.access_token},
                {httpsAgent}
            );
            tokenData = data;
        } catch {                                           // Refresh failed ⇒ neu
            await getToken();
        }
    }
}

async function auth() {
    if (!tokenData) await getToken();
    return {Authorization: `Bearer ${tokenData.access_token}`};
}

/* -------- Helpers für v2 -------- */
async function listGraphs() {
    try {
        const hdr = await auth();
        const {data} = await axios.get(
            `${base}/v2/graphs?driver=GRAPH_SERVER_PGX`,
            {httpsAgent, headers: hdr}
        );
        return data;
    } catch (e) {
        console.error('ListGraphs failed', e.message);
        return null;
    }
}

async function runPgql(pgql, graph = process.env.GRAPH_NAME || 'knowledge_graph') {
    await ensureToken();
    const body = {
        statements: [pgql],
        driver: 'GRAPH_SERVER_PGX',
        formatter: 'DATASTUDIO',   //  <── liefert rohe Zahlen
        parameters: {start: 0, size: 100},
        visualize: false
    };

    const {data} = await axios.post(
        `${base}/v2/runQuery`,
        body,
        {httpsAgent, headers: {Authorization: `Bearer ${tokenData.access_token}`}}
    );

    // Ergebnis des ersten Statements
    const res = data.results[0].result;

    // DATASTUDIO: Aggregat = Zahl, sonst evtl. JSON-String
    return typeof res === 'string' ? JSON.parse(res) : res;
}

module.exports = {listGraphs, runPgql};
