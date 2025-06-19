// test-connections.js - Separates Test-Script
const oracledb = require('oracledb');
const { initializeOraclePool, getOracleConnection, getMemgraphSession, closeOraclePool, closeMemgraphDriver } = require('./src/config/database');

async function testOracleConnection() {
    console.log('\n🔍 Teste Oracle Verbindung...');
    let connection;

    try {
        await initializeOraclePool();
        connection = await getOracleConnection();

        // Test Query
        const result = await connection.execute(
            `SELECT 'Verbindung erfolgreich' as status,
                    SYS_CONTEXT('USERENV', 'DB_NAME') as database_name,
                    USER as connected_user
             FROM DUAL`
        );

        console.log('✅ Oracle Verbindung erfolgreich!');
        console.log('📊 Verbindungsdetails:', result.rows[0]);

        // Optional: Tabellen anzeigen
        const tables = await connection.execute(
            `SELECT table_name FROM user_tables`
        );
        console.log('📋 Verfügbare Tabellen:', tables.rows.map(row => row[0]));

        return true;
    } catch (error) {
        console.error('❌ Oracle Verbindungsfehler:', error.message);
        return false;
    } finally {
        if (connection) {
            await connection.close();
        }
    }
}

async function testMemgraphConnection() {
    console.log('\n🔍 Teste Memgraph Verbindung...');
    let session;

    try {
        session = getMemgraphSession();

        // Test Query
        const result = await session.run(
            `RETURN 'Verbindung erfolgreich' as status, 
              'Memgraph' as database_type`
        );

        console.log('✅ Memgraph Verbindung erfolgreich!');
        console.log('📊 Verbindungsdetails:', result.records[0].toObject());

        // Memgraph-spezifische Queries für Schema-Informationen
        try {
            // Alle Node Labels
            const labels = await session.run(
                `MATCH (n) RETURN DISTINCT labels(n) as labels`
            );
            const uniqueLabels = new Set();
            labels.records.forEach(record => {
                const nodeLabels = record.get('labels');
                nodeLabels.forEach(label => uniqueLabels.add(label));
            });
            console.log('🏷️  Verfügbare Labels:', Array.from(uniqueLabels));

            // Anzahl der Nodes pro Label
            const counts = await session.run(
                `MATCH (n) UNWIND labels(n) as label 
         RETURN label, count(*) as count 
         ORDER BY count DESC`
            );
            console.log('📊 Nodes pro Label:');
            counts.records.forEach(record => {
                console.log(`   - ${record.get('label')}: ${record.get('count').toNumber()} Nodes`);
            });
        } catch (e) {
            console.log('ℹ️  Keine Schema-Informationen verfügbar');
        }

        return true;
    } catch (error) {
        console.error('❌ Memgraph Verbindungsfehler:', error.message);
        return false;
    } finally {
        if (session) {
            await session.close();
        }
    }
}

async function runAllTests() {
    console.log('🚀 Starte Datenbank-Verbindungstests...');
    console.log('================================');

    const oracleOk = await testOracleConnection();
    const memgraphOk = await testMemgraphConnection();

    if (oracleOk && memgraphOk) {
        console.log('\n✅ Alle Verbindungen erfolgreich!');

        // Vorhandene Daten anzeigen
        console.log('\n📋 Überprüfe vorhandene Daten...');
        await showExistingData();

    } else {
        console.log('\n⚠️  Einige Verbindungen fehlgeschlagen. Bitte prüfen Sie die Konfiguration.');
    }

    // Cleanup
    await closeOraclePool();
    await closeMemgraphDriver();

    console.log('\n🏁 Tests abgeschlossen');
    process.exit(0);
}

async function showExistingData() {
    console.log('\n════════════════════════════════════════');
    console.log('📊 VORHANDENE DATEN IN DEN DATENBANKEN');
    console.log('════════════════════════════════════════');

    // Oracle Daten
    let connection;
    try {
        console.log('\n🗄️  ORACLE DATENBANK:');
        console.log('─────────────────────');
        connection = await getOracleConnection();

        // Prüfe aktuelles Schema
        const currentSchema = await connection.execute(
            `SELECT USER FROM DUAL`,
            [],
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        console.log(`📌 Aktuelles Schema: ${currentSchema.rows[0].USER}`);

        // Alle Tabellen (verschiedene Ansätze)
        let tables = await connection.execute(
            `SELECT table_name 
       FROM user_tables 
       ORDER BY table_name`,
            [],
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        // Falls keine Tabellen im user_tables, prüfe all_tables
        if (tables.rows.length === 0) {
            console.log('   Keine Tabellen in user_tables gefunden, prüfe all_tables...');

            tables = await connection.execute(
                `SELECT owner, table_name 
         FROM all_tables 
         WHERE owner = :owner
         ORDER BY table_name`,
                [currentSchema.rows[0].USER],
                { outFormat: oracledb.OUT_FORMAT_OBJECT }
            );
        }

        // Falls immer noch keine Tabellen, zeige alle verfügbaren Schemas
        if (tables.rows.length === 0) {
            console.log('   Keine Tabellen gefunden. Verfügbare Schemas:');

            const schemas = await connection.execute(
                `SELECT DISTINCT owner 
         FROM all_tables 
         WHERE owner NOT IN ('SYS', 'SYSTEM', 'APEX_040000', 'APEX_PUBLIC_USER', 'FLOWS_FILES', 'HR', 'MDSYS', 'XDB')
         ORDER BY owner`,
                [],
                { outFormat: oracledb.OUT_FORMAT_OBJECT }
            );

            console.log('   Schemas:', schemas.rows.map(s => s.OWNER).join(', '));

            // Prüfe ob es Objekte gibt
            const objects = await connection.execute(
                `SELECT object_type, COUNT(*) as count 
         FROM user_objects 
         GROUP BY object_type 
         ORDER BY object_type`,
                [],
                { outFormat: oracledb.OUT_FORMAT_OBJECT }
            );

            console.log('\n   Verfügbare Objekte im aktuellen Schema:');
            objects.rows.forEach(obj => {
                console.log(`   - ${obj.OBJECT_TYPE}: ${obj.COUNT}`);
            });
        } else {
            // Tabellen gefunden - zeige Daten
            for (const table of tables.rows) {
                const tableName = table.TABLE_NAME;
                const owner = table.OWNER || currentSchema.rows[0].USER;

                console.log(`\n📁 Tabelle: ${tableName}`);

                try {
                    // Spalten der Tabelle
                    const columns = await connection.execute(
                        `SELECT column_name, data_type, nullable
             FROM all_tab_columns 
             WHERE table_name = :tableName AND owner = :owner
             ORDER BY column_id`,
                        [tableName, owner],
                        { outFormat: oracledb.OUT_FORMAT_OBJECT }
                    );

                    if (columns.rows.length > 0) {
                        console.log('   Spalten:', columns.rows.map(c =>
                            `${c.COLUMN_NAME} (${c.DATA_TYPE}${c.NULLABLE === 'N' ? ', NOT NULL' : ''})`
                        ).join(', '));

                        // Erste 5 Datensätze
                        const data = await connection.execute(
                            `SELECT * FROM ${owner}.${tableName} WHERE ROWNUM <= 5`,
                            [],
                            { outFormat: oracledb.OUT_FORMAT_OBJECT }
                        );

                        console.log(`   Anzahl Beispieldaten: ${data.rows.length}`);
                        if (data.rows.length > 0) {
                            console.log('   Beispieldaten:');
                            data.rows.forEach((row, index) => {
                                console.log(`   ${index + 1}.`, JSON.stringify(row, null, 2).replace(/\n/g, '\n      '));
                            });
                        }

                        // Gesamtanzahl
                        const count = await connection.execute(
                            `SELECT COUNT(*) as total FROM ${owner}.${tableName}`,
                            [],
                            { outFormat: oracledb.OUT_FORMAT_OBJECT }
                        );
                        console.log(`   Gesamtanzahl Datensätze: ${count.rows[0].TOTAL}`);
                    } else {
                        console.log('   ⚠️  Keine Spalteninformationen verfügbar');
                    }

                } catch (e) {
                    console.log(`   ⚠️  Fehler beim Lesen der Tabelle: ${e.message}`);
                }
            }
        }

        // Views prüfen
        const views = await connection.execute(
            `SELECT view_name FROM user_views ORDER BY view_name`,
            [],
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        if (views.rows.length > 0) {
            console.log('\n📋 Views:');
            views.rows.forEach(v => console.log(`   - ${v.VIEW_NAME}`));
        }

    } catch (error) {
        console.error('❌ Fehler beim Lesen der Oracle-Daten:', error.message);
    } finally {
        if (connection) await connection.close();
    }

    // Memgraph Daten
    let session;
    try {
        console.log('\n\n🗄️  MEMGRAPH DATENBANK:');
        console.log('─────────────────────');
        session = getMemgraphSession();

        // Alle Labels mit Beispieldaten
        const labels = await session.run(
            `MATCH (n) 
       RETURN DISTINCT labels(n) as labels, count(*) as count`
        );

        for (const record of labels.records) {
            const nodeLabels = record.get('labels');
            const count = record.get('count').toNumber();

            for (const label of nodeLabels) {
                console.log(`\n📁 Label: ${label}`);
                console.log(`   Anzahl Nodes: ${count}`);

                // Properties und Beispieldaten
                const examples = await session.run(
                    `MATCH (n:${label}) 
           RETURN n 
           LIMIT 5`
                );

                if (examples.records.length > 0) {
                    // Properties aus dem ersten Node
                    const firstNode = examples.records[0].get('n');
                    console.log('   Properties:', Object.keys(firstNode.properties).join(', '));

                    console.log('   Beispieldaten:');
                    examples.records.forEach((record, index) => {
                        const node = record.get('n');
                        console.log(`   ${index + 1}.`, JSON.stringify(node.properties, null, 2).replace(/\n/g, '\n      '));
                    });
                }
            }
        }

        // Relationships
        console.log('\n📐 RELATIONSHIPS:');
        const relationships = await session.run(
            `MATCH ()-[r]->() 
       RETURN TYPE(r) as type, count(*) as count
       ORDER BY count DESC`
        );

        if (relationships.records.length > 0) {
            relationships.records.forEach(record => {
                console.log(`   - ${record.get('type')}: ${record.get('count').toNumber()} Beziehungen`);
            });

            // Beispiel-Beziehungen
            console.log('\n   Beispiel-Beziehungen:');
            const exampleRels = await session.run(
                `MATCH (a)-[r]->(b) 
         RETURN labels(a)[0] as from, TYPE(r) as rel, labels(b)[0] as to, r
         LIMIT 5`
            );

            exampleRels.records.forEach((record, index) => {
                const from = record.get('from');
                const rel = record.get('rel');
                const to = record.get('to');
                const relProps = record.get('r').properties;

                console.log(`   ${index + 1}. ${from} -[${rel}]-> ${to}`);
                if (Object.keys(relProps).length > 0) {
                    console.log(`      Properties:`, JSON.stringify(relProps, null, 2).replace(/\n/g, '\n      '));
                }
            });
        } else {
            console.log('   Keine Beziehungen gefunden');
        }

    } catch (error) {
        console.error('❌ Fehler beim Lesen der Memgraph-Daten:', error.message);
    } finally {
        if (session) await session.close();
    }

    console.log('\n════════════════════════════════════════\n');
}

// Test ausführen
runAllTests().catch(console.error);