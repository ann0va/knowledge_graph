// insert-demo.js
require('dotenv').config();
const { runPgql } = require('./src/services/pgxService');

(async () => {
    // Personen-Knoten
    await runPgql("INSERT VERTEX PERSON (id, name) VALUES (1, 'Alice')");
    await runPgql("INSERT VERTEX PERSON (id, name) VALUES (2, 'Bob')");

    // Kante
    await runPgql("INSERT EDGE KNOWS VALUES (1, 2)");

    // Zähler holen
    const vCnt = await runPgql('SELECT COUNT(*) FROM MATCH (v)');
    const eCnt = await runPgql('SELECT COUNT(*) FROM MATCH ()-[e]->()');

    console.log('\n✅   Einfügen abgeschlossen');
    console.log('    Knoten (Vertex):', vCnt);   // erwartet 2 (oder höher)
    console.log('    Kanten (Edge) :', eCnt);   // erwartet 1 (oder höher)
})();
