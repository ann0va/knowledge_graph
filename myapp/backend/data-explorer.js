// data-explorer.js - Vollständiger Daten-Export
const fs = require('fs').promises;
const { initializeOraclePool, getOracleConnection, getMemgraphSession, closeOraclePool, closeMemgraphDriver } = require('./src/config/database');
const oracledb = require('oracledb');

async function exportAllData() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outputFile = `data-export-${timestamp}.json`;
    const output = {
        timestamp: new Date().toISOString(),
        oracle: {},
        memgraph: {}
    };

    console.log('🔍 Starte Daten-Export...\n');

    // Oracle Export
    let connection;
    try {
        await initializeOraclePool();
        connection = await getOracleConnection();

        console.log('📊 Oracle Datenbank:');

        // Alle Tabellen
        const tables = await connection.execute(
            `SELECT table_name FROM user_tables ORDER BY table_name`,
            [],
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        output.oracle.tables = {};

        for (const table of tables.rows) {
            const tableName = table.TABLE_NAME;
            console.log(`   Exportiere ${tableName}...`);

            // Schema
            const schema = await connection.execute(
                `SELECT column_name, data_type, nullable, data_default
         FROM user_tab_columns 
         WHERE table_name = :tableName
         ORDER BY column_id`,
                [tableName],
                { outFormat: oracledb.OUT_FORMAT_OBJECT }
            );

            // Daten
            const data = await connection.execute(
                `SELECT * FROM ${tableName}`,
                [],
                { outFormat: oracledb.OUT_FORMAT_OBJECT }
            );

            // Constraints
            const constraints = await connection.execute(
                `SELECT constraint_name, constraint_type, search_condition
         FROM user_constraints
         WHERE table_name = :tableName`,
                [tableName],
                { outFormat: oracledb.OUT_FORMAT_OBJECT }
            );

            output.oracle.tables[tableName] = {
                schema: schema.rows,
                data: data.rows,
                constraints: constraints.rows,
                rowCount: data.rows.length
            };

            console.log(`      ✓ ${data.rows.length} Datensätze`);
        }

        // Views
        const views = await connection.execute(
            `SELECT view_name, text FROM user_views`,
            [],
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        output.oracle.views = views.rows;

    } catch (error) {
        console.error('❌ Oracle Export Fehler:', error.message);
        output.oracle.error = error.message;
    } finally {
        if (connection) await connection.close();
    }

    // Memgraph Export
    let session;
    try {
        console.log('\n📊 Memgraph Datenbank:');
        session = getMemgraphSession();

        // Alle Nodes
        console.log('   Exportiere Nodes...');
        const nodes = await session.run(
            `MATCH (n) 
       RETURN id(n) as id, labels(n) as labels, properties(n) as properties`
        );

        output.memgraph.nodes = nodes.records.map(record => ({
            id: record.get('id').toNumber(),
            labels: record.get('labels'),
            properties: record.get('properties')
        }));
        console.log(`      ✓ ${output.memgraph.nodes.length} Nodes`);

        // Alle Relationships
        console.log('   Exportiere Relationships...');
        const relationships = await session.run(
            `MATCH (a)-[r]->(b) 
       RETURN id(a) as startId, id(r) as relId, TYPE(r) as type, 
              properties(r) as properties, id(b) as endId`
        );

        output.memgraph.relationships = relationships.records.map(record => ({
            id: record.get('relId').toNumber(),
            startId: record.get('startId').toNumber(),
            endId: record.get('endId').toNumber(),
            type: record.get('type'),
            properties: record.get('properties')
        }));
        console.log(`      ✓ ${output.memgraph.relationships.length} Relationships`);

        // Indexes (falls vorhanden)
        try {
            const indexes = await session.run(`SHOW INDEX INFO`);
            output.memgraph.indexes = indexes.records.map(r => r.toObject());
        } catch (e) {
            // Memgraph könnte andere Syntax für Indexes haben
            output.memgraph.indexes = [];
        }

        // Statistiken
        output.memgraph.statistics = {
            nodeCount: output.memgraph.nodes.length,
            relationshipCount: output.memgraph.relationships.length,
            labelCounts: {},
            relationshipTypeCounts: {}
        };

        // Label-Statistiken
        output.memgraph.nodes.forEach(node => {
            node.labels.forEach(label => {
                output.memgraph.statistics.labelCounts[label] =
                    (output.memgraph.statistics.labelCounts[label] || 0) + 1;
            });
        });

        // Relationship-Typ-Statistiken
        output.memgraph.relationships.forEach(rel => {
            output.memgraph.statistics.relationshipTypeCounts[rel.type] =
                (output.memgraph.statistics.relationshipTypeCounts[rel.type] || 0) + 1;
        });

    } catch (error) {
        console.error('❌ Memgraph Export Fehler:', error.message);
        output.memgraph.error = error.message;
    } finally {
        if (session) await session.close();
    }

    // In Datei speichern
    try {
        await fs.writeFile(outputFile, JSON.stringify(output, null, 2));
        console.log(`\n✅ Daten erfolgreich exportiert nach: ${outputFile}`);

        // Zusammenfassung
        console.log('\n📊 Export-Zusammenfassung:');
        console.log('────────────────────────');

        if (output.oracle.tables) {
            console.log('\nOracle:');
            Object.entries(output.oracle.tables).forEach(([table, data]) => {
                console.log(`  - ${table}: ${data.rowCount} Datensätze`);
            });
        }

        if (output.memgraph.statistics) {
            console.log('\nMemgraph:');
            console.log(`  - Nodes: ${output.memgraph.statistics.nodeCount}`);
            console.log(`  - Relationships: ${output.memgraph.statistics.relationshipCount}`);
            console.log('  - Labels:', Object.entries(output.memgraph.statistics.labelCounts)
                .map(([label, count]) => `${label} (${count})`).join(', '));
        }

    } catch (error) {
        console.error('❌ Fehler beim Speichern der Datei:', error.message);
    }

    // Cleanup
    await closeOraclePool();
    await closeMemgraphDriver();
    process.exit(0);
}

// Script ausführen
exportAllData().catch(console.error);