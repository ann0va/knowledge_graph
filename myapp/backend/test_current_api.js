// test_current_api.js - Test der aktuellen Entity API
const EntityRepository = require('./src/repositories/EntityRepository');
const RepositoryFactory = require('./src/repositories/RepositoryFactory');

async function testCurrentAPI() {
    console.log('🧪 Testing Current Entity API Setup...\n');

    try {
        // 1. Test RepositoryFactory
        console.log('1️⃣ Testing RepositoryFactory...');
        const factory = new RepositoryFactory(null, null); // DBs werden in Repositories selbst geholt

        console.log('Available entity types:', factory.getAvailableEntityTypes());

        // 2. Test Repository Creation
        console.log('\n2️⃣ Testing Repository Creation...');

        const memgraphPersonRepo = factory.getRepository('person', 'memgraph');
        const oraclePersonRepo = factory.getRepository('person', 'oracle');

        console.log('✅ Repositories created successfully');

        // 3. Test Memgraph Labels
        console.log('\n3️⃣ Testing Memgraph Labels...');

        // Test verschiedene Label-Varianten
        const labelTests = ['person', 'Person', 'PERSON'];

        for (const label of labelTests) {
            try {
                console.log(`Testing label: ${label}`);

                // Direkter Query-Test
                const testRepo = new EntityRepository(null, 'memgraph', 'person');
                testRepo.config.memgraph_label = label; // Override label

                const result = await testRepo.execute({
                    memgraph: `MATCH (p:${label}) RETURN COUNT(p) as count`
                });

                console.log(`  Label "${label}": ${result[0]?.count || 'ERROR'} nodes`);

            } catch (error) {
                console.log(`  Label "${label}": ERROR - ${error.message}`);
            }
        }

        // 4. Test findAll mit verschiedenen Labels
        console.log('\n4️⃣ Testing findAll with different labels...');

        // Original findAll
        try {
            const result = await memgraphPersonRepo.findAll(5);
            console.log(`✅ Original findAll: ${result.length} results`);
            if (result.length > 0) {
                console.log('Sample:', result[0]);
            }
        } catch (error) {
            console.log(`❌ Original findAll failed: ${error.message}`);
        }

        // 5. Test Oracle
        console.log('\n5️⃣ Testing Oracle...');
        try {
            const oracleResult = await oraclePersonRepo.findAll(3);
            console.log(`✅ Oracle findAll: ${oracleResult.length} results`);
            if (oracleResult.length > 0) {
                console.log('Sample Oracle:', oracleResult[0]);
            }
        } catch (error) {
            console.log(`❌ Oracle findAll failed: ${error.message}`);
        }

        // 6. Test Search direkt
        console.log('\n6️⃣ Testing Search...');
        try {
            const searchResult = await memgraphPersonRepo.searchByName('Alan', 5);
            console.log(`✅ Memgraph search "Alan": ${searchResult.length} results`);
            console.log('Search results:', searchResult);
        } catch (error) {
            console.log(`❌ Memgraph search failed: ${error.message}`);
        }

    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

// Direct database label test
async function testLabelsDirectly() {
    console.log('\n🔍 Testing Labels Directly...');

    const { getMemgraphSession } = require('./src/config/database');
    const session = getMemgraphSession();

    try {
        // Test alle möglichen Label-Varianten
        const labels = ['person', 'Person', 'PERSON', 'people', 'People'];

        for (const label of labels) {
            try {
                const result = await session.run(`MATCH (n:${label}) RETURN COUNT(n) as count`);
                const count = result.records[0].get('count').toNumber();
                console.log(`Label "${label}": ${count} nodes`);

                if (count > 0) {
                    // Sample data
                    const sampleResult = await session.run(`MATCH (n:${label}) RETURN n LIMIT 1`);
                    if (sampleResult.records.length > 0) {
                        const node = sampleResult.records[0].get('n');
                        console.log(`  Sample properties:`, Object.keys(node.properties));
                        console.log(`  Sample name:`, node.properties.name);
                    }
                }
            } catch (error) {
                console.log(`Label "${label}": NOT FOUND`);
            }
        }

    } finally {
        await session.close();
    }
}

if (require.main === module) {
    testCurrentAPI()
        .then(() => testLabelsDirectly())
        .then(() => {
            console.log('\n🎯 Tests completed!');
            process.exit(0);
        })
        .catch(error => {
            console.error('❌ Test failed:', error);
            process.exit(1);
        });
}