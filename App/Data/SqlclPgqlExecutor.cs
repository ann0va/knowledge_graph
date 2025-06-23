using System;
using System.Diagnostics;
using System.IO;
using System.Threading.Tasks;
using Microsoft.Extensions.Configuration;

namespace App.Data
{
    public class SqlclPgqlExecutor
    {
        private readonly string _connectionString;
        private readonly string _username;
        private readonly string _password;
        private readonly string _host;
        private string _sqlclPath;

        public SqlclPgqlExecutor(IConfiguration configuration)
        {
            _connectionString = configuration.GetConnectionString("Oracle");
            
            // Extract connection components for SQLcl
            _username = "team25s5";
            _password = "team25s5.c017";
            _host = "c017-node3.infcs.de:1521/FREEPDB1";
            
            // Find and store SQLcl path during initialization
            _sqlclPath = FindSqlclPath();
        }

        public async Task<bool> CreatePgqlPropertyGraph()
        {
            try
            {
                Console.WriteLine("🔧 Creating PGQL Property Graph through SQLcl...");

                // Updated PGQL script for Oracle 23ai Free
                var pgqlScript = @"
-- Drop existing graph if exists (ignore errors)
DROP PROPERTY GRAPH knowledge_graph_pgql;

-- Create PGQL Property Graph (without PG_PGQL option)
CREATE PROPERTY GRAPH knowledge_graph_pgql
VERTEX TABLES (
    persons 
        KEY (id) 
        LABEL Person 
        PROPERTIES (name, birth_date, death_date, gender, description),
    works 
        KEY (id) 
        LABEL Work 
        PROPERTIES (name),
    awards
        KEY (id) 
        LABEL Award 
        PROPERTIES (name),
    places 
        KEY (id) 
        LABEL Place 
        PROPERTIES (name, type),
    workplaces 
        KEY (id) 
        LABEL Workplace 
        PROPERTIES (name, type),
    fields 
        KEY (id) 
        LABEL Field 
        PROPERTIES (name),
    occupations 
        KEY (id) 
        LABEL Occupation 
        PROPERTIES (name)
)
EDGE TABLES (
    worked_at 
        KEY (start_id, end_id)
        SOURCE KEY (start_id) REFERENCES persons(id)
        DESTINATION KEY (end_id) REFERENCES workplaces(id)
        LABEL WORKED_AT
        PROPERTIES (start_date, end_date),
    created 
        KEY (start_id, end_id)
        SOURCE KEY (start_id) REFERENCES persons(id)
        DESTINATION KEY (end_id) REFERENCES works(id)
        LABEL CREATED,
    works_in 
        KEY (start_id, end_id)
        SOURCE KEY (start_id) REFERENCES persons(id)
        DESTINATION KEY (end_id) REFERENCES fields(id)
        LABEL SPECIALIZED_IN,
    has_occupation 
        KEY (start_id, end_id)
        SOURCE KEY (start_id) REFERENCES persons(id)
        DESTINATION KEY (end_id) REFERENCES occupations(id)
        LABEL HAS_OCCUPATION,
    received
        KEY (start_id, end_id)
        SOURCE KEY (start_id) REFERENCES persons(id)
        DESTINATION KEY (end_id) REFERENCES awards(id)
        LABEL RECEIVED,
    birth_in
        KEY (start_id, end_id)
        SOURCE KEY (start_id) REFERENCES persons(id)
        DESTINATION KEY (end_id) REFERENCES places(id)
        LABEL BORN_IN,
    died_in
        KEY (start_id, end_id)
        SOURCE KEY (start_id) REFERENCES persons(id)
        DESTINATION KEY (end_id) REFERENCES places(id)
        LABEL DIED_IN,
    national_of
        KEY (start_id, end_id)
        SOURCE KEY (start_id) REFERENCES persons(id)
        DESTINATION KEY (end_id) REFERENCES places(id)
        LABEL NATIONAL_OF,
    advisor_of
        KEY (start_id, end_id)
        SOURCE KEY (start_id) REFERENCES persons(id)
        DESTINATION KEY (end_id) REFERENCES persons(id)
        LABEL ADVISOR_OF,
    father_of
        KEY (start_id, end_id)
        SOURCE KEY (start_id) REFERENCES persons(id)
        DESTINATION KEY (end_id) REFERENCES persons(id)
        LABEL FATHER_OF,
    mother_of
        KEY (start_id, end_id)
        SOURCE KEY (start_id) REFERENCES persons(id)
        DESTINATION KEY (end_id) REFERENCES persons(id)
        LABEL MOTHER_OF,
    influenced_by
        KEY (start_id, end_id)
        SOURCE KEY (start_id) REFERENCES persons(id)
        DESTINATION KEY (end_id) REFERENCES persons(id)
        LABEL INFLUENCED_BY,
    partner_of
        KEY (start_id, end_id)
        SOURCE KEY (start_id) REFERENCES persons(id)
        DESTINATION KEY (end_id) REFERENCES persons(id)
        LABEL PARTNER_OF,
    relative_of
        KEY (start_id, end_id)
        SOURCE KEY (start_id) REFERENCES persons(id)
        DESTINATION KEY (end_id) REFERENCES persons(id)
        LABEL RELATIVE_OF,
    significant_person_for
        KEY (start_id, end_id)
        SOURCE KEY (start_id) REFERENCES persons(id)
        DESTINATION KEY (end_id) REFERENCES persons(id)
        LABEL SIGNIFICANT_FOR,
    student_of
        KEY (start_id, end_id)
        SOURCE KEY (start_id) REFERENCES persons(id)
        DESTINATION KEY (end_id) REFERENCES persons(id)
        LABEL STUDENT_OF
);

-- Verify graph creation
SELECT graph_name FROM user_property_graphs WHERE graph_name = 'KNOWLEDGE_GRAPH_PGQL';

-- Exit SQLcl
exit;
";

                return await ExecuteSqlclScript(pgqlScript, "CREATE PGQL Property Graph");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ Error creating PGQL Property Graph: {ex.Message}");
                return false;
            }
        }

        public async Task<bool> ExecutePgqlQuery(string query, string description = "PGQL Query")
        {
            try
            {
                // Use standard SQL with GRAPH_TABLE for Oracle 23ai Free
                var script = $@"
-- Execute graph query using GRAPH_TABLE
{query}

-- Exit SQLcl
exit;
";
                return await ExecuteSqlclScript(script, description);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ Error executing PGQL query: {ex.Message}");
                return false;
            }
        }

        public async Task<string> GetGraphVisualizationData()
        {
            try
            {
                Console.WriteLine("📊 Getting graph visualization data...");

                // Use simplified SQL for visualization data
                var visualizationQuery = @"
-- Get sample nodes and edges for visualization
SELECT p.name as source_name, 'WORKED_AT' as edge_label, w.name as target_name
FROM persons p, workplaces w, worked_at wa
WHERE p.id = wa.start_id AND w.id = wa.end_id AND ROWNUM <= 10
UNION ALL
SELECT p.name as source_name, 'CREATED' as edge_label, work.name as target_name
FROM persons p, works work, created c
WHERE p.id = c.start_id AND work.id = c.end_id AND ROWNUM <= 10;

-- Exit SQLcl
exit;
";

                var result = await ExecuteSqlclScriptWithOutput(visualizationQuery);
                return result;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ Error getting visualization data: {ex.Message}");
                return string.Empty;
            }
        }

        private async Task<bool> ExecuteSqlclScript(string script, string description)
        {
            var result = await ExecuteSqlclScriptWithOutput(script);
            
            if (!string.IsNullOrEmpty(result) && !result.ToUpper().Contains("ERROR") && !result.ToUpper().Contains("ORA-"))
            {
                Console.WriteLine($"✅ {description} executed successfully!");
                return true;
            }
            else
            {
                Console.WriteLine($"❌ {description} completed with errors:");
                Console.WriteLine(result);
                return false;
            }
        }

        private async Task<string> ExecuteSqlclScriptWithOutput(string script)
        {
            // ✅ Check if SQLcl path is available
            if (string.IsNullOrEmpty(_sqlclPath))
            {
                throw new Exception("SQLcl not found. Please install SQLcl and add to PATH or use the install-sqlcl.ps1 script.");
            }

            // Create temporary script file
            var scriptPath = Path.GetTempFileName() + ".sql";
            await File.WriteAllTextAsync(scriptPath, script);

            try
            {
                // Configure SQLcl process
                var processInfo = new ProcessStartInfo
                {
                    FileName = _sqlclPath,  // ✅ Uses: C:\Oracle\SQLcl\sqlcl\bin\sql.exe
                    Arguments = $"{_username}/{_password}@{_host} @\"{scriptPath}\"",
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    UseShellExecute = false,
                    CreateNoWindow = true,
                    WorkingDirectory = Path.GetTempPath()
                };

                Console.WriteLine($"🔧 Executing SQLcl: {Path.GetFileName(_sqlclPath)} {_username}/***@{_host}");

                // Start SQLcl
                using var process = Process.Start(processInfo);
                if (process == null)
                {
                    throw new Exception("Failed to start SQLcl process");
                }

                var output = await process.StandardOutput.ReadToEndAsync();
                var error = await process.StandardError.ReadToEndAsync();
                
                await process.WaitForExitAsync();

                // Combine output
                var result = output;
                if (!string.IsNullOrEmpty(error))
                {
                    result += "\n--- STDERR ---\n" + error;
                }

                return result;
            }
            finally
            {
                // Delete temporary file
                try
                {
                    File.Delete(scriptPath);
                }
                catch
                {
                    // Ignore deletion errors
                }
            }
        }

        private string FindSqlclPath()
        {
            try
            {
                Console.WriteLine("🔍 Searching for SQLcl installation...");
                
                var commonPaths = new[]
                {
                    "sql", // In PATH
                    "sql.cmd", // Try .cmd version
                    @"C:\Oracle\SQLcl\sqlcl\bin\sql.exe",
                    @"C:\Oracle\SQLcl\sqlcl\bin\sql.cmd",
                    @"C:\sqlcl\bin\sql.exe",
                    @"C:\sqlcl\bin\sql.cmd",
                    Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "Oracle", "SQLcl", "sqlcl", "bin", "sql.exe"),
                    Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "Oracle", "SQLcl", "sqlcl", "bin", "sql.cmd")
                };

                foreach (var path in commonPaths)
                {
                    try
                    {
                        var startInfo = new ProcessStartInfo
                        {
                            FileName = path,
                            Arguments = "-version",
                            RedirectStandardOutput = true,
                            RedirectStandardError = true,
                            UseShellExecute = false,
                            CreateNoWindow = true
                        };

                        using var process = Process.Start(startInfo);
                        if (process != null)
                        {
                            process.WaitForExit(5000); // 5 second timeout
                            if (process.ExitCode == 0)
                            {
                                Console.WriteLine($"✅ Found SQLcl at: {path}");
                                return path; // ✅ Return the working path
                            }
                        }
                    }
                    catch
                    {
                        // Continue to next path
                    }
                }

                Console.WriteLine("❌ SQLcl not found in any common locations");
                return null; // ✅ SQLcl not found
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ Error searching for SQLcl: {ex.Message}");
                return null;
            }
        }

        public async Task<bool> TestSqlclConnection()
        {
            try
            {
                Console.WriteLine("🔍 Testing SQLcl connection...");
                
                // ✅ Check if SQLcl is available first
                if (!IsSqlclAvailable())
                {
                    Console.WriteLine("❌ SQLcl not found. Please install SQLcl or add it to PATH.");
                    return false;
                }

                // Test connection with a simple query
                var testScript = "SELECT 'Connection successful' as status FROM dual;";
                var result = await ExecuteSqlclScriptWithOutput(testScript);
                
                if (result.Contains("Connection successful") || result.Contains("STATUS"))
                {
                    Console.WriteLine("✅ SQLcl connection successful!");
                    return true;
                }
                else
                {
                    Console.WriteLine($"❌ SQLcl connection failed: {result}");
                    return false;
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ SQLcl connection test failed: {ex.Message}");
                return false;
            }
        }

        public bool IsSqlclAvailable()
        {
            // ✅ Simply check if SQLcl path was found during initialization
            return !string.IsNullOrEmpty(_sqlclPath);
        }

        public async Task<bool> CreateGraphQueries()
        {
            try
            {
                Console.WriteLine("📊 Creating sample PGQL queries...");

                var queries = new[]
                {
                    @"-- Count all persons using GRAPH_TABLE
SELECT COUNT(*) as person_count
FROM GRAPH_TABLE(knowledge_graph_pgql 
    MATCH (n:Person)
    COLUMNS (n.id)
);",
                    @"-- Find all relationships using simplified syntax
SELECT p1.name as source_name, 'WORKED_AT' as edge_label, w.name as target_name
FROM persons p1, workplaces w, worked_at wa
WHERE p1.id = wa.start_id AND w.id = wa.end_id
AND ROWNUM <= 5
UNION ALL
SELECT p1.name as source_name, 'CREATED' as edge_label, work.name as target_name  
FROM persons p1, works work, created c
WHERE p1.id = c.start_id AND work.id = c.end_id
AND ROWNUM <= 5;",
                    @"-- Find specific person using GRAPH_TABLE
SELECT name, id
FROM GRAPH_TABLE(knowledge_graph_pgql 
    MATCH (n:Person)
    COLUMNS (n.name, n.id)
) WHERE name LIKE '%Turing%' OR name LIKE '%Alan%';"
                };

                foreach (var query in queries)
                {
                    Console.WriteLine($"\n🔍 Executing query: {query.Split('\n')[0]}");
                    await ExecutePgqlQuery(query);
                }

                return true;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ Error executing queries: {ex.Message}");
                return false;
            }
        }
    }
} 