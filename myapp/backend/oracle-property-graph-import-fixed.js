// oracle-property-graph-import-fixed.js - Korrigierte Version für Oracle 23ai
const fs = require('fs').promises;
const { initializeOraclePool, getOracleConnection, closeOraclePool } = require('./src/config/database');

// Parser für Cypher CREATE Statements
function parseCypherCreate(line) {
    // Node parsen
    const nodeMatch = line.match(/CREATE\s+\(:__mg_vertex__:`(\w+)`\s+({[^}]+})\);/);
    if (nodeMatch) {
        const label = nodeMatch[1];
        const propsStr = nodeMatch[2];

        const props = {};
        let mgId = null;

        const propRegex = /`?([^`:\s]+)`?\s*:\s*("(?:[^"\\]|\\.)*"|[^,}]+)/g;
        let match;
        while ((match = propRegex.exec(propsStr)) !== null) {
            let key = match[1];
            let value = match[2];

            if (key === '__mg_id__') {
                mgId = parseInt(value);
                continue;
            }

            if (key === ':LABEL') key = 'label';

            if (value.startsWith('"') && value.endsWith('"')) {
                value = value.slice(1, -1).replace(/\\'/g, "'").replace(/\\"/g, '"');
            }

            props[key] = value;
        }

        return { type: 'node', label, properties: props, mgId };
    }

    // Relationship parsen
    const relMatch = line.match(/MATCH.*WHERE\s+u\.__mg_id__\s*=\s*(\d+)\s+AND\s+v\.__mg_id__\s*=\s*(\d+)\s+CREATE\s+\(u\)-\[:`(\w+)`(?:\s+({[^}]+}))?\]->\(v\);/);
    if (relMatch) {
        return {
            type: 'relationship',
            fromMgId: parseInt(relMatch[1]),
            toMgId: parseInt(relMatch[2]),
            relType: relMatch[3],
            properties: {}
        };
    }

    return null;
}

async function importToOraclePropertyGraph(filename) {
    console.log('🌐 Oracle 23ai Property Graph Import');
    console.log('====================================\n');

    let connection;
    const mgIdMapping = {};

    try {
        // Datei lesen und parsen
        console.log(`📖 Lese Datei: ${filename}`);
        const content = await fs.readFile(filename, 'utf8');
        const lines = content.split('\n').filter(line => line.trim());

        const nodes = [];
        const relationships = [];

        for (const line of lines) {
            if (line.startsWith('CREATE (:')) {
                const parsed = parseCypherCreate(line);
                if (parsed?.type === 'node') nodes.push(parsed);
            } else if (line.startsWith('MATCH')) {
                const parsed = parseCypherCreate(line);
                if (parsed?.type === 'relationship') relationships.push(parsed);
            }
        }

        console.log(`✅ Gefunden: ${nodes.length} Vertices, ${relationships.length} Edges\n`);

        await initializeOraclePool();
        connection = await getOracleConnection();

        // 1. Tabellen leeren (falls Daten vorhanden)
        console.log('🧹 Bereinige bestehende Daten...');
        try {
            await connection.execute(`DELETE FROM kg_edges`);
            await connection.execute(`DELETE FROM kg_vertices`);
            await connection.commit();
            console.log('✅ Tabellen bereinigt\n');
        } catch (e) {
            console.log('ℹ️  Keine bestehenden Daten\n');
        }

        // 2. Vertices einfügen
        console.log('🔸 Füge Vertices ein...');

        let vertexCount = 0;
        for (const node of nodes) {
            const vertexId = node.properties.id;
            const vertexType = node.label.toUpperCase();

            mgIdMapping[node.mgId] = vertexId;

            const propJson = JSON.stringify(node.properties);

            try {
                await connection.execute(
                    `INSERT INTO kg_vertices (vertex_id, vertex_type, properties)
                     VALUES (:id, :type, :props)`,
                    {
                        id: vertexId,
                        type: vertexType,
                        props: propJson
                    },
                    { autoCommit: false }
                );

                vertexCount++;
                if (vertexCount % 50 === 0) {
                    await connection.commit();
                    console.log(`   ${vertexCount} Vertices eingefügt...`);
                }
            } catch (e) {
                console.error(`   ❌ Fehler bei Vertex ${vertexId}: ${e.message}`);
            }
        }

        await connection.commit();
        console.log(`✅ ${vertexCount} Vertices eingefügt\n`);

        // 3. Edges einfügen
        console.log('🔗 Füge Edges ein...');

        let edgeCount = 0;
        for (const rel of relationships) {
            const sourceId = mgIdMapping[rel.fromMgId];
            const destId = mgIdMapping[rel.toMgId];

            if (!sourceId || !destId) continue;

            try {
                await connection.execute(
                    `INSERT INTO kg_edges (source_vertex_id, dest_vertex_id, edge_label, properties)
                     VALUES (:source, :dest, :label, :props)`,
                    {
                        source: sourceId,
                        dest: destId,
                        label: rel.relType,
                        props: '{}'
                    },
                    { autoCommit: false }
                );

                edgeCount++;
                if (edgeCount % 100 === 0) {
                    await connection.commit();
                    console.log(`   ${edgeCount} Edges eingefügt...`);
                }
            } catch (e) {
                console.error(`   ❌ Fehler bei Edge ${sourceId}->${destId}: ${e.message}`);
            }
        }

        await connection.commit();
        console.log(`✅ ${edgeCount} Edges eingefügt\n`);

        // 4. Property Graph erstellen
        console.log('🌐 Erstelle Property Graph Definition...');

        // Erst löschen falls vorhanden
        try {
            await connection.execute(`DROP PROPERTY GRAPH IF EXISTS knowledge_graph`);
        } catch (e) {
            // Graph existiert nicht - ok
        }

        // Neuen Graph erstellen
        const createGraphSQL = `
      CREATE PROPERTY GRAPH IF NOT EXISTS knowledge_graph
        VERTEX TABLES (
          kg_vertices 
            KEY (vertex_id)
            PROPERTIES (vertex_id, vertex_type, properties)
        )
        EDGE TABLES (
          kg_edges
            KEY (edge_id)
            SOURCE KEY (source_vertex_id) REFERENCES kg_vertices(vertex_id)
            DESTINATION KEY (dest_vertex_id) REFERENCES kg_vertices(vertex_id)
            PROPERTIES (edge_label, properties)
        )
    `;

        try {
            await connection.execute(createGraphSQL);
            await connection.commit();
            console.log('✅ Property Graph erfolgreich erstellt!\n');
        } catch (e) {
            console.error('❌ Fehler beim Erstellen des Property Graph:', e.message);
            throw e;
        }

        // 5. Test mit SQL/PGQ
        console.log('🔍 Teste Property Graph mit SQL/PGQ...');

        try {
            const testQuery = `
                SELECT COUNT(*) as person_count
                FROM GRAPH_TABLE (knowledge_graph
                    MATCH (v)
          WHERE v.vertex_type = 'PERSON'
          COLUMNS (1 as dummy)
                     )
            `;

            const result = await connection.execute(testQuery);
            console.log(`✅ SQL/PGQ Test erfolgreich - ${result.rows[0][0]} Personen im Graph\n`);
        } catch (e) {
            console.error('❌ SQL/PGQ Test fehlgeschlagen:', e.message);
            console.log('\n⚠️  Möglicherweise muss die Syntax angepasst werden.');
        }

        // 6. Statistiken
        console.log('📊 Import-Statistiken:');

        const stats = await connection.execute(`
            SELECT vertex_type, COUNT(*) as cnt
            FROM kg_vertices
            GROUP BY vertex_type
            ORDER BY vertex_type
        `);

        console.log('   Vertices:');
        stats.rows.forEach(row => console.log(`     - ${row[0]}: ${row[1]}`));

        const edgeStats = await connection.execute(`
            SELECT edge_label, COUNT(*) as cnt
            FROM kg_edges
            GROUP BY edge_label
            ORDER BY edge_label
        `);

        console.log('   Edges:');
        edgeStats.rows.forEach(row => console.log(`     - ${row[0]}: ${row[1]}`));

    } catch (error) {
        console.error('❌ Import-Fehler:', error.message);
        console.error(error);
        if (connection) {
            await connection.rollback();
        }
    } finally {
        if (connection) await connection.close();
        await closeOraclePool();
    }
}

// Script ausführen
if (require.main === module) {
    const filename = process.argv[2] || 'memgraph-export.txt';

    console.log('🚀 Starte Oracle 23ai Property Graph Import...\n');

    importToOraclePropertyGraph(filename)
        .then(() => {
            console.log('\n✅ Import erfolgreich abgeschlossen!');
            console.log('\n📝 Nächste Schritte:');
            console.log('   1. Backend neu starten: npm start');
            console.log('   2. API testen: curl http://c017-master.infcs.de:10510/api/person');
            process.exit(0);
        })
        .catch(error => {
            console.error('Fatal:', error);
            process.exit(1);
        });
}

module.exports = { importToOraclePropertyGraph };