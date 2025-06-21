// test-sql-pgq.js - Testet verschiedene SQL/PGQ Syntax-Varianten
const { initializeOraclePool, getOracleConnection, closeOraclePool } = require('./src/config/database');

async function testSQLPGQ() {
    console.log('🧪 Oracle 23ai SQL/PGQ Syntax Test\n');

    let connection;
    try {
        await initializeOraclePool();
        connection = await getOracleConnection();

        // Test 1: Direkte Tabellen-Abfrage (sollte funktionieren)
        console.log('1️⃣  Test direkte Tabellen-Abfrage:');
        try {
            const result = await connection.execute(
                `SELECT COUNT(*) as cnt FROM kg_vertices WHERE vertex_type = 'PERSON'`
            );
            console.log(`   ✅ ${result.rows[0][0]} Personen in kg_vertices`);
        } catch (e) {
            console.log(`   ❌ Fehler: ${e.message}`);
        }

        // Test 2: GRAPH_TABLE Syntax
        console.log('\n2️⃣  Test GRAPH_TABLE Syntax:');
        try {
            const result = await connection.execute(`
        SELECT v.vertex_id
        FROM GRAPH_TABLE (knowledge_graph
          MATCH (v)
          WHERE v.vertex_type = 'PERSON'
          COLUMNS (v.vertex_id)
        )
        WHERE ROWNUM = 1
      `);
            console.log(`   ✅ GRAPH_TABLE funktioniert!`);
            console.log(`   Ergebnis:`, result.rows[0]);
        } catch (e) {
            console.log(`   ❌ GRAPH_TABLE Fehler: ${e.message}`);
            console.log(`   → GRAPH_TABLE wird NICHT unterstützt!`);
        }

        // Test 3: Alternative - direkte SQL mit JSON
        console.log('\n3️⃣  Test JSON-basierte Queries:');
        try {
            const result = await connection.execute(`
        SELECT vertex_id, 
               JSON_VALUE(properties, '$.name') as name
        FROM kg_vertices
        WHERE vertex_type = 'PERSON'
          AND JSON_VALUE(properties, '$.name') IS NOT NULL
          AND ROWNUM <= 3
      `);
            console.log(`   ✅ JSON_VALUE funktioniert!`);
            result.rows.forEach(row => {
                console.log(`   - ${row[0]}: ${row[1]}`);
            });
        } catch (e) {
            console.log(`   ❌ JSON_VALUE Fehler: ${e.message}`);
        }

        // Test 4: Beziehungen mit normalem SQL
        console.log('\n4️⃣  Test Beziehungen (ohne GRAPH_TABLE):');
        try {
            const result = await connection.execute(`
        SELECT e.source_vertex_id,
               e.dest_vertex_id,
               e.edge_label
        FROM kg_edges e
        WHERE ROWNUM <= 5
      `);
            console.log(`   ✅ Edge-Query funktioniert!`);
            console.log(`   ${result.rows.length} Beziehungen gefunden`);
        } catch (e) {
            console.log(`   ❌ Edge-Query Fehler: ${e.message}`);
        }

        // Test 5: Join zwischen Vertices und Edges
        console.log('\n5️⃣  Test Join-Query:');
        try {
            const result = await connection.execute(`
        SELECT s.vertex_id as source_id,
               JSON_VALUE(s.properties, '$.name') as source_name,
               e.edge_label,
               t.vertex_id as target_id,
               JSON_VALUE(t.properties, '$.name') as target_name
        FROM kg_edges e
        JOIN kg_vertices s ON e.source_vertex_id = s.vertex_id
        JOIN kg_vertices t ON e.dest_vertex_id = t.vertex_id
        WHERE s.vertex_type = 'PERSON'
          AND ROWNUM <= 3
      `);
            console.log(`   ✅ Join funktioniert!`);
            result.rows.forEach(row => {
                console.log(`   ${row[1]} --[${row[2]}]--> ${row[4]}`);
            });
        } catch (e) {
            console.log(`   ❌ Join Fehler: ${e.message}`);
        }

    } catch (error) {
        console.error('❌ Test-Fehler:', error.message);
    } finally {
        if (connection) await connection.close();
        await closeOraclePool();
    }
}

// Script ausführen
testSQLPGQ()
    .then(() => {
        console.log('\n📋 EMPFEHLUNG:');
        console.log('Wenn GRAPH_TABLE nicht funktioniert, verwenden Sie normale SQL-Queries');
        console.log('mit JSON_VALUE() für Property-Zugriff und JOINs für Beziehungen.');
    })
    .catch(console.error);