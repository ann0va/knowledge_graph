// ALL_GRAPH Creator und Visualizer
// Erstellt kompletten Graph aus allen Tabellen und visualisiert ihn
const { OracleGraphRESTClient } = require('./oracle_graph_js_client');

class AllGraphCreator {
    constructor() {
        this.client = new OracleGraphRESTClient();
        this.graphName = 'ALL_GRAPH';
    }

    async createCompleteGraph() {
        try {
            console.log('🚀 Creating ALL_GRAPH from database tables...\n');

            // Authentifizieren
            if (!await this.client.authenticate()) {
                throw new Error('Authentication failed');
            }

            // 1. Drop existing graph
            await this.dropExistingGraph();

            // 2. Create Property Graph
            await this.createPropertyGraph();

            // 3. Verify creation
            await this.verifyGraph();

            // 4. Show graph statistics
            await this.showGraphStats();

            // 5. Visualize graph data
            await this.visualizeGraph();

            console.log('\n🎉 ALL_GRAPH successfully created and analyzed!');

        } catch (error) {
            console.error('❌ Error:', error.message);
        }
    }

    async dropExistingGraph() {
        console.log('🗑️ Dropping existing ALL_GRAPH and related tables...');

        try {
            // 1. Drop Property Graph selbst
            const dropGraphQuery = `DROP PROPERTY GRAPH ${this.graphName}`;
            const graphResult = await this.client.runPGQLQuery(dropGraphQuery);

            if (graphResult?.results?.[0]?.success) {
                console.log('✅ Property Graph dropped');
            } else {
                console.log('ℹ️ No existing Property Graph to drop');
            }

            // 2. Drop zusätzliche Metadaten-Tabellen
            const metadataTables = [
                `${this.graphName}_ELEM_TABLE$`,
                `${this.graphName}_KEY$`,
                `${this.graphName}_LABEL$`,
                `${this.graphName}_PROPERTY$`,
                `${this.graphName}_SRC_DST_KEY$`
            ];

            console.log('🗑️ Dropping metadata tables...');

            for (const tableName of metadataTables) {
                try {
                    const dropTableQuery = `DROP TABLE ${tableName}`;
                    const tableResult = await this.client.runPGQLQuery(dropTableQuery);

                    if (tableResult?.results?.[0]?.success) {
                        console.log(`✅ Table ${tableName} dropped`);
                    } else {
                        console.log(`ℹ️ Table ${tableName} does not exist or already dropped`);
                    }
                } catch (error) {
                    // Einzelne Tabellen-Drops sollten nicht den ganzen Prozess stoppen
                    console.log(`⚠️ Could not drop table ${tableName}: ${error.message}`);
                }
            }

            console.log('✅ Graph cleanup completed');

        } catch (error) {
            console.warn('⚠️ Error during graph cleanup:', error.message);
            // Nicht werfen, da wir trotzdem weitermachen wollen
        }
    }

    async createPropertyGraph() {
        console.log('🔧 Creating Property Graph...');

        const createQuery = `
            CREATE PROPERTY GRAPH ${this.graphName}
            VERTEX TABLES (
                persons KEY (id) LABEL Person 
                    PROPERTIES (name, birth_date, death_date, gender, description),
                awards KEY (id) LABEL Award 
                    PROPERTIES (name),
                fields KEY (id) LABEL Field 
                    PROPERTIES (name),
                occupations KEY (id) LABEL Occupation 
                    PROPERTIES (name),
                places KEY (id) LABEL Place 
                    PROPERTIES (name, type),
                workplaces KEY (id) LABEL Workplace 
                    PROPERTIES (name, type),
                works KEY (id) LABEL Work 
                    PROPERTIES (name, type)
            )
            EDGE TABLES (
                received_edges 
                    KEY (person_id, award_id)
                    SOURCE KEY (person_id) REFERENCES persons(id)
                    DESTINATION KEY (award_id) REFERENCES awards(id)
                    LABEL RECEIVED,
                works_in_edges 
                    KEY (person_id, field_id)
                    SOURCE KEY (person_id) REFERENCES persons(id)
                    DESTINATION KEY (field_id) REFERENCES fields(id)
                    LABEL WORKS_IN,
                has_occupation_edges 
                    KEY (person_id, occupation_id)
                    SOURCE KEY (person_id) REFERENCES persons(id)
                    DESTINATION KEY (occupation_id) REFERENCES occupations(id)
                    LABEL HAS_OCCUPATION,
                birth_in_edges 
                    KEY (person_id, place_id)
                    SOURCE KEY (person_id) REFERENCES persons(id)
                    DESTINATION KEY (place_id) REFERENCES places(id)
                    LABEL BORN_IN,
                died_in_edges 
                    KEY (person_id, place_id)
                    SOURCE KEY (person_id) REFERENCES persons(id)
                    DESTINATION KEY (place_id) REFERENCES places(id)
                    LABEL DIED_IN,
                national_of_edges 
                    KEY (person_id, place_id)
                    SOURCE KEY (person_id) REFERENCES persons(id)
                    DESTINATION KEY (place_id) REFERENCES places(id)
                    LABEL NATIONAL_OF,
                worked_at_edges 
                    KEY (person_id, workplace_id)
                    SOURCE KEY (person_id) REFERENCES persons(id)
                    DESTINATION KEY (workplace_id) REFERENCES workplaces(id)
                    LABEL WORKED_AT
                    PROPERTIES (end_date),
                created_edges 
                    KEY (person_id, work_id)
                    SOURCE KEY (person_id) REFERENCES persons(id)
                    DESTINATION KEY (work_id) REFERENCES works(id)
                    LABEL CREATED,
                student_of_edges 
                    KEY (student_id, teacher_id)
                    SOURCE KEY (student_id) REFERENCES persons(id)
                    DESTINATION KEY (teacher_id) REFERENCES persons(id)
                    LABEL STUDENT_OF,
                advised_edges 
                    KEY (advisor_id, advisee_id)
                    SOURCE KEY (advisor_id) REFERENCES persons(id)
                    DESTINATION KEY (advisee_id) REFERENCES persons(id)
                    LABEL ADVISED,
                parent_edges 
                    KEY (parent_id, child_id)
                    SOURCE KEY (parent_id) REFERENCES persons(id)
                    DESTINATION KEY (child_id) REFERENCES persons(id)
                    LABEL PARENT_OF
                    PROPERTIES (relationship_type),
                partner_edges 
                    KEY (person1_id, person2_id)
                    SOURCE KEY (person1_id) REFERENCES persons(id)
                    DESTINATION KEY (person2_id) REFERENCES persons(id)
                    LABEL PARTNER_OF,
                influence_edges 
                    KEY (influenced_id, influencer_id)
                    SOURCE KEY (influenced_id) REFERENCES persons(id)
                    DESTINATION KEY (influencer_id) REFERENCES persons(id)
                    LABEL INFLUENCED_BY,
                relative_edges 
                    KEY (person1_id, person2_id)
                    SOURCE KEY (person1_id) REFERENCES persons(id)
                    DESTINATION KEY (person2_id) REFERENCES persons(id)
                    LABEL RELATIVE_OF,
                significant_person_edges 
                    KEY (significant_person_id, for_person_id)
                    SOURCE KEY (significant_person_id) REFERENCES persons(id)
                    DESTINATION KEY (for_person_id) REFERENCES persons(id)
                    LABEL SIGNIFICANT_FOR
            )
            OPTIONS (PG_PGQL)
        `;

        const result = await this.client.runPGQLQuery(createQuery);

        if (result?.results?.[0]?.success) {
            console.log('✅ Property Graph created successfully');
        } else {
            console.error('❌ Graph creation failed:', result?.results?.[0]?.error);
            throw new Error('Graph creation failed');
        }
    }

    async verifyGraph() {
        console.log('🔍 Verifying graph creation...');

        const graphs = await this.client.getGraphs('PGQL_IN_DATABASE');
        const ourGraph = graphs.find(g => g.graphName === this.graphName);

        if (ourGraph) {
            console.log('✅ Graph verified:', ourGraph);
        } else {
            throw new Error('Graph not found after creation');
        }
    }

    async showGraphStats() {
        console.log('\n📊 Graph Statistics:');

        const statsQueries = [
            {
                name: 'Total Nodes',
                query: `SELECT COUNT(*) as total_nodes FROM MATCH (n) ON ${this.graphName}`
            },
            {
                name: 'Total Edges',
                query: `SELECT COUNT(*) as total_edges FROM MATCH () -[e]-> () ON ${this.graphName}`
            },
            {
                name: 'Person Nodes',
                query: `SELECT COUNT(*) as person_count FROM MATCH (n:Person) ON ${this.graphName}`
            },
            {
                name: 'Award Nodes',
                query: `SELECT COUNT(*) as award_count FROM MATCH (n:Award) ON ${this.graphName}`
            },
            {
                name: 'Field Nodes',
                query: `SELECT COUNT(*) as field_count FROM MATCH (n:Field) ON ${this.graphName}`
            },
            {
                name: 'Workplace Nodes',
                query: `SELECT COUNT(*) as workplace_count FROM MATCH (n:Workplace) ON ${this.graphName}`
            },
            {
                name: 'Work Nodes',
                query: `SELECT COUNT(*) as work_count FROM MATCH (n:Work) ON ${this.graphName}`
            }
        ];

        for (const stat of statsQueries) {
            const result = await this.client.runPGQLQuery(stat.query);
            if (result?.results?.[0]?.success) {
                try {
                    const data = JSON.parse(result.results[0].result);
                    console.log(`  ${stat.name}: ${Object.values(data.table ? JSON.parse(data.table) : data)[0] || 'N/A'}`);
                } catch (e) {
                    console.log(`  ${stat.name}: ${result.results[0].result}`);
                }
            }
        }
    }

    async visualizeGraph() {
        console.log('\n🎨 Graph Visualization Data:');

        // Holen der wichtigsten Nodes und Edges für Visualisierung
        const vizQueries = [
            {
                name: 'Key People',
                query: `SELECT p.id, p.name as person_name FROM MATCH (p:Person) ON ${this.graphName} LIMIT 10`
            },
            {
                name: 'Person-Workplace Connections',
                query: `SELECT p.name as person, w.name as workplace 
                        FROM MATCH (p:Person) -[:WORKED_AT]-> (w:Workplace) ON ${this.graphName} LIMIT 5`
            },
            {
                name: 'Person-Award Connections',
                query: `SELECT p.name as person, a.name as award 
                        FROM MATCH (p:Person) -[:RECEIVED]-> (a:Award) ON ${this.graphName} LIMIT 5`
            },
            {
                name: 'Alan Turing Connections',
                query: `SELECT p1.name as person, label(e) as relationship, p2.name as connected_to
                        FROM MATCH (p1:Person) -[e]-> (p2:Person) ON ${this.graphName}
                        WHERE p1.name = 'Alan Turing' LIMIT 10`
            }
        ];

        for (const viz of vizQueries) {
            console.log(`\n  ${viz.name}:`);
            const result = await this.client.runPGQLQuery(viz.query);

            if (result?.results?.[0]?.success) {
                try {
                    const data = JSON.parse(result.results[0].result);
                    if (data.table) {
                        const lines = data.table.split('\n');
                        lines.slice(0, 6).forEach(line => {
                            if (line.trim()) console.log(`    ${line}`);
                        });
                    }
                } catch (e) {
                    console.log(`    ${result.results[0].result.substring(0, 200)}...`);
                }
            }
        }
    }

    async getFullVisualizationData() {
        console.log('\n📈 Getting full visualization data...');

        const nodeQuery = `SELECT n.id, label(n) as node_type, n.name 
                          FROM MATCH (n) ON ${this.graphName} LIMIT 100`;

        const edgeQuery = `SELECT id(src) as source, id(dst) as target, label(e) as edge_type
                          FROM MATCH (src) -[e]-> (dst) ON ${this.graphName} LIMIT 200`;

        const [nodeResult, edgeResult] = await Promise.all([
            this.client.runPGQLQuery(nodeQuery),
            this.client.runPGQLQuery(edgeQuery)
        ]);

        const vizData = {
            nodes: this.extractTableData(nodeResult),
            edges: this.extractTableData(edgeResult)
        };

        console.log(`✅ Visualization data: ${vizData.nodes.length} nodes, ${vizData.edges.length} edges`);
        return vizData;
    }

    extractTableData(pgqlResult) {
        if (!pgqlResult?.results?.[0]?.success) return [];

        try {
            const data = JSON.parse(pgqlResult.results[0].result);
            if (data.table) {
                const lines = data.table.split('\n').filter(line => line.trim());
                return lines.slice(1).map(line => line.split('\t')); // Skip header
            }
        } catch (e) {
            console.warn('Could not parse table data:', e.message);
        }
        return [];
    }
}

// Express Endpoint für Graph-Erstellung
async function createAllGraphAPI(req, res) {
    try {
        const creator = new AllGraphCreator();
        await creator.createCompleteGraph();
        const vizData = await creator.getFullVisualizationData();

        res.json({
            success: true,
            message: 'ALL_GRAPH created successfully',
            visualizationData: vizData
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
}

// Express Server erweitern
const express = require('express');
const app = express();
app.use(express.json());

app.post('/api/create-all-graph', createAllGraphAPI);

app.get('/api/all-graph/stats', async (req, res) => {
    try {
        const creator = new AllGraphCreator();
        await creator.client.authenticate();
        await creator.showGraphStats();
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/all-graph/visualization', async (req, res) => {
    try {
        const creator = new AllGraphCreator();
        await creator.client.authenticate();
        const vizData = await creator.getFullVisualizationData();
        res.json(vizData);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = { AllGraphCreator, createAllGraphAPI };

// Direkte Ausführung
if (require.main === module) {
    if (process.argv.includes('--server')) {
        const PORT = process.env.PORT || 3001;
        app.listen(PORT, () => {
            console.log(`🚀 ALL_GRAPH Server auf Port ${PORT}`);
            console.log(`📊 Create Graph: POST /api/create-all-graph`);
            console.log(`📈 Visualization: GET /api/all-graph/visualization`);
        });
    } else {
        const creator = new AllGraphCreator();
        creator.createCompleteGraph();
    }
}