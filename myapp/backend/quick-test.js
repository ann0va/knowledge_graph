// quick-test.js - Parameter Fix Verification
const RepositoryFactory = require('./src/repositories');
const MemgraphRepository = require('./src/repositories/MemgraphRepository');
const { getOracleConnection } = require('./src/config/database');

async function testParameterFix() {
    console.log('🧪 Testing Parameter Fix...\n');

    try {
        // Setup
        const memgraphDb = new MemgraphRepository();
        await memgraphDb.connect();

        const repositoryFactory = new RepositoryFactory(
            { getConnection: getOracleConnection },
            memgraphDb
        );

        // Test Memgraph with string limit
        console.log('1️⃣ Testing Memgraph with string parameter...');
        const memgraphPersonRepo = repositoryFactory.getRepository('person', 'memgraph');

        try {
            const memgraphResult = await memgraphPersonRepo.findAll('5'); // String statt Integer
            console.log('✅ Memgraph Success! Found persons:', memgraphResult.length);
            if (memgraphResult.length > 0) {
                console.log('   Sample:', memgraphResult[0]);
            }
        } catch (error) {
            console.error('❌ Memgraph Error:', error.message);
        }

        // Test Oracle
        console.log('\n2️⃣ Testing Oracle...');
        const oraclePersonRepo = repositoryFactory.getRepository('person', 'oracle');

        try {
            const oracleResult = await oraclePersonRepo.findAll(3);
            console.log('✅ Oracle Success! Found persons:', oracleResult.length);
            if (oracleResult.length > 0) {
                console.log('   Sample:', oracleResult[0]);
            }
        } catch (error) {
            console.error('❌ Oracle Error:', error.message);
        }

        // Test both with both parameter types
        console.log('\n3️⃣ Testing both DBs with different parameter types...');

        const testCases = [
            { limit: 2, desc: 'Integer parameter' },
            { limit: '3', desc: 'String parameter' },
            { limit: '1', desc: 'String "1"' }
        ];

        for (const testCase of testCases) {
            console.log(`\n   📋 Testing ${testCase.desc} (${typeof testCase.limit}): ${testCase.limit}`);

            // Memgraph
            try {
                const mgResult = await memgraphPersonRepo.findAll(testCase.limit);
                console.log(`   ✅ Memgraph: ${mgResult.length} results`);
            } catch (error) {
                console.log(`   ❌ Memgraph: ${error.message}`);
            }

            // Oracle
            try {
                const orResult = await oraclePersonRepo.findAll(testCase.limit);
                console.log(`   ✅ Oracle: ${orResult.length} results`);
            } catch (error) {
                console.log(`   ❌ Oracle: ${error.message}`);
            }
        }

        console.log('\n🎯 Test completed!');

    } catch (error) {
        console.error('❌ Test setup failed:', error.message);
    }
}

if (require.main === module) {
    testParameterFix()
        .then(() => process.exit(0))
        .catch(error => {
            console.error('❌ Test failed:', error);
            process.exit(1);
        });
}

module.exports = testParameterFix;