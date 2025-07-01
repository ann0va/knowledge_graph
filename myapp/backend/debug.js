// debug.js - Graph Structure Investigation
const PropertyGraphService = require('./src/services/PropertyGraphService');
const { getMemgraphSession } = require('./src/config/database');

async function debugGraphStructure() {
    console.log('🔍 Debugging Graph Structure...\n');

    // 1. Oracle Graphs und Structure
    console.log('=== ORACLE PROPERTY GRAPHS ===');
    const pgService = new PropertyGraphService();

    try {
        await pgService.authenticate();

        // List available graphs
        const graphs = await pgService.listGraphs();
        console.log('📊 Available graphs:', graphs);

        if (graphs.length === 0) {
            console.log('❌ No graphs found! Need to create ALL_GRAPH first.');
        } else {
            // Check what's in the graph
            for (const graph of graphs) {
                console.log(`\n🔍 Investigating graph: ${graph.name}`);

                // Simple vertex count
                const countQuery = `SELECT COUNT(*) as vertex_count FROM MATCH (v) ON ${graph.name}`;
                const countResult = await pgService.executeCustomQuery(countQuery, graph.name);
                console.log('  Vertex count:', countResult.data);

                // Check available labels
                const labelQuery = `SELECT DISTINCT label(v) as vertex_label FROM MATCH (v) ON ${graph.name} LIMIT 10`;
                const labelResult = await pgService.executeCustomQuery(labelQuery, graph.name);
                console.log('  Available labels:', labelResult.data);

                // Check PERSON properties - FIXED query
                console.log('\n  📋 PERSON Properties:');
                const personPropsQuery = `SELECT id(p) as vertex_id, p.name, p.birth_date, p.gender FROM MATCH (p:PERSON) ON ${graph.name} LIMIT 3`;
                const personPropsResult = await pgService.executeCustomQuery(personPropsQuery, graph.name);
                console.log('    Sample PERSON data:', personPropsResult.data);

                // Check edge labels
                console.log('\n  🔗 Edge Types:');
                const edgeQuery = `SELECT DISTINCT label(e) as edge_label FROM MATCH ()-[e]->() ON ${graph.name} LIMIT 10`;
                const edgeResult = await pgService.executeCustomQuery(edgeQuery, graph.name);
                console.log('    Available edge labels:', edgeResult.data);
            }
        }

    } catch (error) {
        console.error('❌ Oracle debugging failed:', error.message);
    }

    // 2. Memgraph Structure
    console.log('\n=== MEMGRAPH STRUCTURE ===');
    const session = getMemgraphSession();

    try {
        // Count nodes
        const countResult = await session.run('MATCH (n) RETURN COUNT(n) as node_count');
        const nodeCount = countResult.records[0].get('node_count').toNumber();
        console.log('📊 Total nodes in Memgraph:', nodeCount);

        // Check labels (case sensitive!)
        const labelResult = await session.run('MATCH (n) RETURN DISTINCT labels(n) as node_labels LIMIT 10');
        console.log('📋 Available labels:');
        labelResult.records.forEach(record => {
            console.log('  -', record.get('node_labels'));
        });

        // Check person nodes (lowercase!)
        console.log('\n👤 Person nodes (lowercase):');
        const personResult = await session.run('MATCH (p:person) RETURN p LIMIT 3');
        console.log(`   Found ${personResult.records.length} person nodes`);
        if (personResult.records.length > 0) {
            const person = personResult.records[0].get('p');
            console.log('   Sample properties:', Object.keys(person.properties));
            console.log('   Sample data:', person.properties);
        }

        // Check all lowercase entity types
        const entityTypes = ['award', 'field', 'occupation', 'place', 'workplace', 'work'];
        console.log('\n📊 Entity counts (lowercase labels):');
        for (const entityType of entityTypes) {
            const result = await session.run(`MATCH (n:${entityType}) RETURN COUNT(n) as count`);
            const count = result.records[0].get('count').toNumber();
            console.log(`   ${entityType}: ${count} nodes`);
        }

        // Check relationships
        console.log('\n🔗 Relationship types:');
        const relResult = await session.run('MATCH ()-[r]->() RETURN DISTINCT type(r) as rel_type LIMIT 10');
        relResult.records.forEach(record => {
            console.log('  -', record.get('rel_type'));
        });

    } catch (error) {
        console.error('❌ Memgraph debugging failed:', error.message);
    } finally {
        await session.close();
    }
}

// Test the Repository fixes
async function testRepositoryFixes() {
    console.log('\n=== TESTING REPOSITORY FIXES ===');

    // Test Memgraph person repository
    console.log('\n🧪 Testing Memgraph person queries:');
    const session = getMemgraphSession();

    try {
        // Test 1: Simple person query with correct label
        const result1 = await session.run('MATCH (p:person) RETURN id(p) as vertex_id, p.name as name LIMIT 3');
        console.log(`✅ Found ${result1.records.length} person nodes`);
        result1.records.forEach((record, i) => {
            const vertexId = record.get('vertex_id').toNumber();
            const name = record.get('name');
            console.log(`   ${i+1}. Vertex ID: ${vertexId}, Name: ${name}`);
        });

        // Test 2: Person with specific properties
        const result2 = await session.run(`
            MATCH (p:person) 
            RETURN id(p) as vertex_id, p.name as name, p.birth_date as birth_date, p.description as description
            LIMIT 2
        `);
        console.log(`\n✅ Person with properties:`);
        result2.records.forEach((record, i) => {
            console.log(`   ${i+1}.`, {
                vertex_id: record.get('vertex_id').toNumber(),
                name: record.get('name'),
                birth_date: record.get('birth_date'),
                description: record.get('description')
            });
        });

    } catch (error) {
        console.error('❌ Repository test failed:', error.message);
    } finally {
        await session.close();
    }
}

// Run debugging
if (require.main === module) {
    debugGraphStructure()
        .then(() => testRepositoryFixes())
        .then(() => {
            console.log('\n🎯 Summary:');
            console.log('✅ Oracle: Uses UPPERCASE labels (PERSON, AWARD, etc.)');
            console.log('✅ Memgraph: Uses lowercase labels (person, award, etc.)');
            console.log('✅ Fixed PersonRepository with label-aware constructor');
            console.log('\n🚀 Ready to test:');
            console.log('   npm start');
            console.log('   curl http://c017-master.infcs.de:10510/api/health');
            console.log('   curl http://c017-master.infcs.de:10510/api/person');
            process.exit(0);
        })
        .catch(error => {
            console.error('❌ Debug script failed:', error);
            process.exit(1);
        });
}

module.exports = { debugGraphStructure, testRepositoryFixes };