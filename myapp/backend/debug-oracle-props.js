// debug-oracle-props.js - Oracle Property Names Investigation
const PropertyGraphService = require('./src/services/PropertyGraphService');

async function debugOracleProperties() {
    console.log('🔍 Debugging Oracle Property Names...\n');

    const pgService = new PropertyGraphService();

    try {
        await pgService.authenticate();

        // 1. Check all properties of PERSON nodes
        console.log('📋 All PERSON properties:');
        const propsQuery = `SELECT p FROM MATCH (p:PERSON) ON ALL_GRAPH LIMIT 1`;
        const propsResult = await pgService.executeCustomQuery(propsQuery);
        console.log('Raw person data:', propsResult);

        // 2. Try different ways to access ID
        const idTests = [
            `SELECT id(p) as vertex_id FROM MATCH (p:PERSON) ON ALL_GRAPH LIMIT 3`,
            `SELECT p.* FROM MATCH (p:PERSON) ON ALL_GRAPH LIMIT 1`,
            `SELECT p.name, p.gender FROM MATCH (p:PERSON) ON ALL_GRAPH LIMIT 3`
        ];

        for (const [i, query] of idTests.entries()) {
            console.log(`\n${i+1}. Testing: ${query}`);
            try {
                const result = await pgService.executeCustomQuery(query);
                console.log('✅ Success:', result.data);
            } catch (error) {
                console.log('❌ Failed:', error.message);
            }
        }

        // 3. Find Alan Turing specifically
        console.log('\n🎯 Finding Alan Turing by name:');
        const turingQuery = `SELECT id(p) as vertex_id, p.name 
                            FROM MATCH (p:PERSON) ON ALL_GRAPH 
                            WHERE p.name = 'Alan Turing'`;
        const turingResult = await pgService.executeCustomQuery(turingQuery);
        console.log('Alan Turing result:', turingResult.data);

        // 4. Try to get the vertex by its actual ID
        if (turingResult.data && turingResult.data.length > 0) {
            const vertexId = turingResult.data[0][0]; // First column
            console.log(`\n🔍 Trying to get person by vertex_id: ${vertexId}`);

            const byVertexIdQuery = `SELECT p.name, p.birth_date 
                                   FROM MATCH (p:PERSON) ON ALL_GRAPH 
                                   WHERE id(p) = '${vertexId}'`;
            const byVertexResult = await pgService.executeCustomQuery(byVertexIdQuery);
            console.log('By vertex ID result:', byVertexResult.data);
        }

    } catch (error) {
        console.error('❌ Debug failed:', error.message);
    }
}

if (require.main === module) {
    debugOracleProperties()
        .then(() => {
            console.log('\n🎯 Debug completed!');
            process.exit(0);
        })
        .catch(error => {
            console.error('❌ Debug script failed:', error);
            process.exit(1);
        });
}

module.exports = debugOracleProperties;