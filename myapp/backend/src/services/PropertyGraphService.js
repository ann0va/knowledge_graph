// src/services/PropertyGraphService.js
const { OracleGraphRESTClient } = require('./OracleGraphRESTClient');

class PropertyGraphService {
    constructor() {
        this.client = new OracleGraphRESTClient();
        this.defaultGraphName = 'ALL_GRAPH';
    }

    async authenticate() {
        if (!await this.client.authenticate()) {
            throw new Error('Oracle Graph authentication failed');
        }
        return true;
    }

    // Graph erstellen/neu erstellen
    async createGraph(graphName = this.defaultGraphName, options = {}) {
        try {
            console.log(`🚀 Creating Property Graph: ${graphName}`);

            await this.authenticate();

            // 1. Existing graph und Metadaten löschen
            await this.dropGraph(graphName);

            // 2. Property Graph erstellen
            await this.createPropertyGraph(graphName);

            // 3. Verification
            const isCreated = await this.verifyGraph(graphName);
            if (!isCreated) {
                throw new Error('Graph verification failed');
            }

            // 4. Stats holen
            const stats = await this.getGraphStats(graphName);

            console.log(`✅ Property Graph '${graphName}' successfully created`);

            return {
                success: true,
                graphName,
                stats,
                message: `Property Graph '${graphName}' created successfully`
            };

        } catch (error) {
            console.error(`❌ Error creating graph '${graphName}':`, error.message);
            throw error;
        }
    }

    // Graph löschen (erweiterte Version mit Metadaten-Cleanup)
    async dropGraph(graphName) {
        console.log(`🗑️ Dropping Property Graph: ${graphName}`);

        try {
            // 1. Property Graph löschen
            const dropGraphQuery = `DROP PROPERTY GRAPH ${graphName}`;
            const graphResult = await this.client.runPGQLQuery(dropGraphQuery);

            if (graphResult?.results?.[0]?.success) {
                console.log('✅ Property Graph dropped');
            } else {
                console.log('ℹ️ No existing Property Graph to drop');
            }

            // 2. Metadaten-Tabellen löschen
            const metadataTables = [
                `${graphName}_ELEM_TABLE$`,
                `${graphName}_KEY$`,
                `${graphName}_LABEL$`,
                `${graphName}_PROPERTY$`,
                `${graphName}_SRC_DST_KEY$`
            ];

            console.log('🗑️ Cleaning up metadata tables...');

            for (const tableName of metadataTables) {
                try {
                    const dropTableQuery = `DROP TABLE ${tableName}`;
                    const tableResult = await this.client.runPGQLQuery(dropTableQuery);

                    if (tableResult?.results?.[0]?.success) {
                        console.log(`✅ Table ${tableName} dropped`);
                    } else {
                        console.log(`ℹ️ Table ${tableName} does not exist`);
                    }
                } catch (error) {
                    console.log(`⚠️ Could not drop table ${tableName}: ${error.message}`);
                }
            }

            console.log('✅ Graph cleanup completed');
            return { success: true };

        } catch (error) {
            console.warn('⚠️ Error during graph cleanup:', error.message);
            return { success: false, error: error.message };
        }
    }

    // Property Graph Definition erstellen
    async createPropertyGraph(graphName) {
        console.log(`🔧 Creating Property Graph schema: ${graphName}`);

        const createQuery = `
            CREATE PROPERTY GRAPH ${graphName}
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
                    LABEL BIRTH_IN,
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
                    LABEL WORKED_AT,
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
                father_edges 
                    KEY (father_id, child_id)
                    SOURCE KEY (father_id) REFERENCES persons(id)
                    DESTINATION KEY (child_id) REFERENCES persons(id)
                    LABEL FATHER_OF,
                mother_edges 
                    KEY (mother_id, child_id)
                    SOURCE KEY (mother_id) REFERENCES persons(id)
                    DESTINATION KEY (child_id) REFERENCES persons(id)
                    LABEL MOTHER_OF,
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
                    LABEL SIGNIFICANT_PERSON_FOR
            )
            OPTIONS (PG_PGQL)
        `;

        const result = await this.client.runPGQLQuery(createQuery);

        if (result?.results?.[0]?.success) {
            console.log('✅ Property Graph schema created');
            return { success: true };
        } else {
            const error = result?.results?.[0]?.error || 'Unknown error';
            console.error('❌ Property Graph creation failed:', error);
            throw new Error(`Property Graph creation failed: ${error}`);
        }
    }

    // Graph Verification
    async verifyGraph(graphName) {
        console.log(`🔍 Verifying graph: ${graphName}`);

        try {
            const graphs = await this.client.getGraphs('PGQL_IN_DATABASE');
            const foundGraph = graphs.find(g => g.graphName === graphName);

            if (foundGraph) {
                console.log('✅ Graph verified:', foundGraph);
                return true;
            } else {
                console.log('❌ Graph not found after creation');
                return false;
            }
        } catch (error) {
            console.error('❌ Graph verification failed:', error.message);
            return false;
        }
    }

    // Graph Statistiken - Fixed für Token Management und Parsing
    async getGraphStats(graphName) {
        console.log(`📊 Getting statistics for: ${graphName}`);

        // Fresh authentication
        await this.authenticate();

        const statsQueries = [
            {
                name: 'Total Nodes',
                query: `SELECT COUNT(*) as total_nodes FROM MATCH (n) ON ${graphName}`
            },
            {
                name: 'Person Nodes',
                query: `SELECT COUNT(*) as person_count FROM MATCH (n:PERSON) ON ${graphName}`
            },
            {
                name: 'Award Nodes',
                query: `SELECT COUNT(*) as award_count FROM MATCH (n:AWARD) ON ${graphName}`
            }
        ];

        const stats = {};

        for (const stat of statsQueries) {
            try {
                // Fresh auth vor jeder Query
                await this.authenticate();

                const result = await this.client.runPGQLQuery(stat.query);
                if (result?.results?.[0]?.success) {
                    const rawResult = result.results[0].result;
                    console.log(`Debug ${stat.name} raw result:`, rawResult.substring(0, 100));

                    // Try different parsing approaches
                    try {
                        const data = JSON.parse(rawResult);

                        if (data.table) {
                            // Table format - parse table
                            const lines = data.table.split('\n').filter(line => line.trim());
                            if (lines.length > 1) {
                                const valueRow = lines[1].split('\t');
                                stats[stat.name] = valueRow[0] || '0';
                            } else {
                                stats[stat.name] = '0';
                            }
                        } else {
                            // Direct value
                            const value = Object.values(data)[0];
                            stats[stat.name] = value || '0';
                        }
                    } catch (parseError) {
                        // If JSON parsing fails, maybe it's plain text
                        console.log(`Parse error for ${stat.name}:`, parseError.message);

                        // Try to extract number from raw string
                        const numberMatch = rawResult.match(/\d+/);
                        stats[stat.name] = numberMatch ? numberMatch[0] : 'Parse Error';
                    }

                    console.log(`  ${stat.name}: ${stats[stat.name]}`);
                } else {
                    stats[stat.name] = 'Query Failed: ' + (result?.results?.[0]?.error || 'Unknown');
                }
            } catch (e) {
                stats[stat.name] = 'Auth Error: ' + e.message;
                console.error(`Error getting ${stat.name}:`, e.message);
            }
        }

        return stats;
    }

    // Visualization Data
    async getVisualizationData(graphName, options = {}) {
        const { nodeLimit = 100, edgeLimit = 200 } = options;

        console.log(`🎨 Getting visualization data for: ${graphName}`);

        try {
            const nodeQuery = `SELECT n.id, label(n) as node_type, n.name
                               FROM MATCH (n) ON ${graphName} LIMIT ${nodeLimit}`;

            const edgeQuery = `SELECT id(src) as source, id(dst) as target, label(e) as edge_type
                               FROM MATCH (src) -[e]-> (dst) ON ${graphName} LIMIT ${edgeLimit}`;

            const [nodeResult, edgeResult] = await Promise.all([
                this.client.runPGQLQuery(nodeQuery),
                this.client.runPGQLQuery(edgeQuery)
            ]);

            const vizData = {
                nodes: this.extractTableData(nodeResult),
                edges: this.extractTableData(edgeResult),
                graphName
            };

            console.log(`✅ Visualization data: ${vizData.nodes.length} nodes, ${vizData.edges.length} edges`);
            return vizData;

        } catch (error) {
            console.error('❌ Error getting visualization data:', error.message);
            return { nodes: [], edges: [], error: error.message };
        }
    }

    // Sample Queries für Exploration
    async runSampleQueries(graphName) {
        const queries = [
            {
                name: 'Key People',
                query: `SELECT p.id, p.name as person_name FROM MATCH (p:Person) ON ${graphName} LIMIT 10`
            },
            {
                name: 'Person-Workplace Connections',
                query: `SELECT p.name as person, w.name as workplace
                        FROM MATCH (p:Person) -[:WORKED_AT]-> (w:Workplace) ON ${graphName} LIMIT 5`
            },
            {
                name: 'Person-Award Connections',
                query: `SELECT p.name as person, a.name as award
                        FROM MATCH (p:Person) -[:RECEIVED]-> (a:Award) ON ${graphName} LIMIT 5`
            }
        ];

        const results = {};

        for (const sample of queries) {
            try {
                console.log(`\n🔍 ${sample.name}:`);
                const result = await this.client.runPGQLQuery(sample.query);

                if (result?.results?.[0]?.success) {
                    results[sample.name] = this.extractTableData(result);
                    console.log(`  ✅ Found ${results[sample.name].length} results`);
                } else {
                    results[sample.name] = [];
                    console.log(`  ⚠️ No results`);
                }
            } catch (error) {
                results[sample.name] = [];
                console.log(`  ❌ Error: ${error.message}`);
            }
        }

        return results;
    }

    // Verfügbare Graphs auflisten
    async listGraphs() {
        try {
            await this.authenticate();
            const graphs = await this.client.getGraphs('PGQL_IN_DATABASE');
            return graphs.map(g => ({
                name: g.graphName,
                driver: g.driver,
                status: g.status || 'unknown'
            }));
        } catch (error) {
            console.error('Error listing graphs:', error.message);
            return [];
        }
    }

    // Helper: Tabellendaten extrahieren
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

    // Custom PGQL Query ausführen
    async executeCustomQuery(query, graphName = this.defaultGraphName) {
        try {
            await this.authenticate();

            // Automatically add graph name if not present
            if (!query.includes(' ON ') && !query.toUpperCase().includes('DROP') && !query.toUpperCase().includes('CREATE')) {
                query = query.replace(/FROM MATCH/gi, `FROM MATCH`).replace(/MATCH/gi, `MATCH`);
                if (!query.includes(` ON ${graphName}`)) {
                    query = query.replace(/ON \w+/gi, `ON ${graphName}`);
                    if (!query.includes(' ON ')) {
                        query = query.replace(/MATCH/, `MATCH`) + ` ON ${graphName}`;
                    }
                }
            }

            const result = await this.client.runPGQLQuery(query);

            if (result?.results?.[0]?.success) {
                return {
                    success: true,
                    data: this.extractTableData(result),
                    raw: result
                };
            } else {
                return {
                    success: false,
                    error: result?.results?.[0]?.error || 'Query failed'
                };
            }
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }
}

module.exports = PropertyGraphService;