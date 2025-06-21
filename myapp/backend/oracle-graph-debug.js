// oracle-graph-debug.js - Prüft Oracle Property Graph Status
const oracledb = require('oracledb');
const { initializeOraclePool, getOracleConnection, closeOraclePool } = require('./src/config/database');

async function debugPropertyGraph() {
    console.log('🔍 Oracle Property Graph Debug\n');

    let connection;
    try {
        await initializeOraclePool();
        connection = await getOracleConnection();

        // 1. Oracle Version prüfen
        console.log('1️⃣  Oracle Version:');
        try {
            const version = await connection.execute(`SELECT * FROM v$version WHERE banner LIKE 'Oracle%'`);
            console.log('   ', version.rows[0][0]);
        } catch (e) {
            console.log('   ❌ Konnte Version nicht abrufen');
        }

        // 2. Prüfe ob kg_vertices und kg_edges existieren
        console.log('\n2️⃣  Prüfe Tabellen:');
        try {
            const tables = await connection.execute(
                `SELECT table_name FROM user_tables WHERE table_name IN ('KG_VERTICES', 'KG_EDGES') ORDER BY table_name`
            );
            if (tables.rows.length > 0) {
                tables.rows.forEach(row => console.log('   ✅', row[0]));
            } else {
                console.log('   ❌ Keine Property Graph Tabellen gefunden!');
            }
        } catch (e) {
            console.log('   ❌ Fehler:', e.message);
        }

        // 3. Prüfe Daten in kg_vertices
        console.log('\n3️⃣  Prüfe Vertex-Daten:');
        try {
            const count = await connection.execute(
                `SELECT vertex_type, COUNT(*) as cnt FROM kg_vertices GROUP BY vertex_type`
            );
            if (count.rows.length > 0) {
                count.rows.forEach(row => console.log(`   - ${row[0]}: ${row[1]} Einträge`));
            } else {
                console.log('   ❌ Keine Vertices gefunden!');
            }
        } catch (e) {
            console.log('   ❌ Fehler:', e.message);
        }

        // 4. Test einfache Query ohne GRAPH_TABLE
        console.log('\n4️⃣  Test einfache Query:');
        try {
            const result = await connection.execute(`
        SELECT vertex_id, vertex_type, properties 
        FROM kg_vertices 
        WHERE vertex_type = 'PERSON' 
        AND ROWNUM <= 5
      `);
            console.log(`   ✅ ${result.rows.length} Personen gefunden`);
            if (result.rows.length > 0) {
                console.log('   Beispiel:', result.rows[0][0]);
            }
        } catch (e) {
            console.log('   ❌ Fehler:', e.message);
        }

        // 5. Test Property Graph Query
        console.log('\n5️⃣  Test Property Graph Query:');
        try {
            const result = await connection.execute(`
        SELECT COUNT(*) FROM user_property_graphs WHERE property_graph_name = 'KNOWLEDGE_GRAPH'
      `);
            if (result.rows[0][0] > 0) {
                console.log('   ✅ Property Graph KNOWLEDGE_GRAPH existiert');
            } else {
                console.log('   ❌ Property Graph KNOWLEDGE_GRAPH existiert NICHT!');
            }
        } catch (e) {
            console.log('   ❌ Property Graphs nicht unterstützt:', e.message);
            console.log('   ℹ️  Möglicherweise keine Oracle 23ai Version');
        }

        // 6. Alternative Query testen
        console.log('\n6️⃣  Empfohlene Lösung:');
        console.log('   Verwende normale SQL-Queries statt GRAPH_TABLE Syntax');
        console.log('   Die Repositories müssen für Standard-SQL angepasst werden');

    } catch (error) {
        console.error('❌ Debug-Fehler:', error.message);
    } finally {
        if (connection) await connection.close();
        await closeOraclePool();
    }
}

// Script ausführen
debugPropertyGraph()
    .then(() => console.log('\n✅ Debug abgeschlossen'))
    .catch(console.error);