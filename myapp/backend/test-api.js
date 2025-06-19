// test-api.js - API Test Script (ohne Frontend)
const http = require('http');

const API_BASE = 'http://localhost:10510/api';

// Hilfsfunktion für HTTP Requests
function makeRequest(method, path, data = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(API_BASE + path);

        const options = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname + url.search,
            method: method,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        const req = http.request(options, (res) => {
            let responseData = '';

            res.on('data', (chunk) => {
                responseData += chunk;
            });

            res.on('end', () => {
                try {
                    resolve({
                        status: res.statusCode,
                        data: JSON.parse(responseData)
                    });
                } catch (e) {
                    resolve({
                        status: res.statusCode,
                        data: responseData
                    });
                }
            });
        });

        req.on('error', reject);

        if (data) {
            req.write(JSON.stringify(data));
        }

        req.end();
    });
}

async function testAPI() {
    console.log('🧪 Teste API Endpoints...\n');

    try {
        // 1. Health Check
        console.log('1️⃣  Health Check:');
        const health = await makeRequest('GET', '/health');
        console.log(`   Status: ${health.status}`);
        console.log(`   Response:`, health.data);

        // 2. Create Test
        console.log('\n2️⃣  Create (Oracle):');
        const createData = await makeRequest('POST', '/create', {
            entity: 'test_users',
            dbType: 'oracle',
            data: {
                name: 'Test User',
                email: 'test@example.com',
                age: 25
            }
        });
        console.log(`   Status: ${createData.status}`);
        console.log(`   Response:`, createData.data);

        // 3. Read Test
        console.log('\n3️⃣  Read (Oracle):');
        const readData = await makeRequest('POST', '/read?entity=test_users&dbType=oracle', {
            where: { age: 25 }
        });
        console.log(`   Status: ${readData.status}`);
        console.log(`   Response:`, readData.data);

        // 4. Create in Memgraph
        console.log('\n4️⃣  Create (Memgraph):');
        const memgraphData = await makeRequest('POST', '/create', {
            entity: 'TestUser',
            dbType: 'memgraph',
            data: {
                name: 'Graph User',
                email: 'graph@example.com',
                age: 30
            }
        });
        console.log(`   Status: ${memgraphData.status}`);
        console.log(`   Response:`, memgraphData.data);

        // 5. Database Info
        console.log('\n5️⃣  Database Info:');
        const dbInfo = await makeRequest('GET', '/databases');
        console.log(`   Status: ${dbInfo.status}`);
        console.log(`   Response:`, dbInfo.data);

    } catch (error) {
        console.error('❌ API Test Fehler:', error.message);
    }
}

// Warten bis Server läuft, dann testen
console.log('⏳ Warte 2 Sekunden bis Server bereit ist...');
setTimeout(() => {
    testAPI().then(() => {
        console.log('\n✅ API Tests abgeschlossen');
        process.exit(0);
    });
}, 2000);