using System;
using System.Collections.Generic;
using System.IO;
using System.Threading.Tasks;
using App.Models;
using Oracle.ManagedDataAccess.Client;
using CsvHelper;
using System.Globalization;
using Microsoft.Extensions.Configuration;
using System.Data;

namespace App.Data
{
    public class MemgraphToOracleConverter
    {
        private readonly string _oracleConnectionString;
        
        public MemgraphToOracleConverter(IConfiguration configuration)
        {
            _oracleConnectionString = configuration.GetConnectionString("Oracle") 
                ?? throw new ArgumentNullException(nameof(configuration), "Oracle connection string is not configured");
        }

        // Create tables for nodes with correct data types
        public async Task CreateNodeTables()
        {
            using var connection = new OracleConnection(_oracleConnectionString);
            await connection.OpenAsync();

            var nodeTables = new Dictionary<string, string>
            {
                { "persons", @"
                    CREATE TABLE persons (
                        id VARCHAR2(20) PRIMARY KEY,
                        name VARCHAR2(255),
                        birth_date DATE,
                        death_date DATE,
                        gender VARCHAR2(50),
                        description VARCHAR2(4000)
                    )" },
                { "works", @"
                    CREATE TABLE works (
                        id VARCHAR2(20) PRIMARY KEY,
                        name VARCHAR2(255)
                    )" },
                { "awards", @"
                    CREATE TABLE awards (
                        id VARCHAR2(20) PRIMARY KEY,
                        name VARCHAR2(255)
                    )" },
                { "places", @"
                    CREATE TABLE places (
                        id VARCHAR2(20) PRIMARY KEY,
                        name VARCHAR2(255),
                        type VARCHAR2(100)
                    )" },
                { "workplaces", @"
                    CREATE TABLE workplaces (
                        id VARCHAR2(20) PRIMARY KEY,
                        name VARCHAR2(255),
                        type VARCHAR2(100)
                    )" },
                { "fields", @"
                    CREATE TABLE fields (
                        id VARCHAR2(20) PRIMARY KEY,
                        name VARCHAR2(255)
                    )" },
                { "occupations", @"
                    CREATE TABLE occupations (
                        id VARCHAR2(20) PRIMARY KEY,
                        name VARCHAR2(255)
                    )" }
            };

            foreach (var table in nodeTables)
            {
                try
                {
                    using var command = new OracleCommand(table.Value, connection);
                    await command.ExecuteNonQueryAsync();
                    Console.WriteLine($"Created table {table.Key} successfully");
                }
                catch (OracleException ex) when (ex.Number == 955) // ORA-00955: name is already used by an existing object
                {
                    Console.WriteLine($"Table {table.Key} already exists");
                }
            }
        }

        // Create tables for edges with correct data types and properties
        public async Task CreateEdgeTables()
        {
            using var connection = new OracleConnection(_oracleConnectionString);
            await connection.OpenAsync();

            var edgeTables = new Dictionary<string, string>
            {
                { "person_workplaces", @"
                    CREATE TABLE person_workplaces (
                        start_id VARCHAR2(20),
                        end_id VARCHAR2(20),
                        start_date DATE,
                        end_date DATE,
                        PRIMARY KEY (start_id, end_id),
                        FOREIGN KEY (start_id) REFERENCES persons(id),
                        FOREIGN KEY (end_id) REFERENCES workplaces(id)
                    )" },
                { "person_to_work", @"
                    CREATE TABLE person_to_work (
                        start_id VARCHAR2(20),
                        end_id VARCHAR2(20),
                        PRIMARY KEY (start_id, end_id),
                        FOREIGN KEY (start_id) REFERENCES persons(id),
                        FOREIGN KEY (end_id) REFERENCES works(id)
                    )" },
                { "person_to_field", @"
                    CREATE TABLE person_to_field (
                        start_id VARCHAR2(20),
                        end_id VARCHAR2(20),
                        PRIMARY KEY (start_id, end_id),
                        FOREIGN KEY (start_id) REFERENCES persons(id),
                        FOREIGN KEY (end_id) REFERENCES fields(id)
                    )" },
                { "person_to_occupation", @"
                    CREATE TABLE person_to_occupation (
                        start_id VARCHAR2(20),
                        end_id VARCHAR2(20),
                        PRIMARY KEY (start_id, end_id),
                        FOREIGN KEY (start_id) REFERENCES persons(id),
                        FOREIGN KEY (end_id) REFERENCES occupations(id)
                    )" },
                { "advisor_of", @"
                    CREATE TABLE advisor_of (
                        start_id VARCHAR2(20),
                        end_id VARCHAR2(20),
                        PRIMARY KEY (start_id, end_id),
                        FOREIGN KEY (start_id) REFERENCES persons(id),
                        FOREIGN KEY (end_id) REFERENCES persons(id)
                    )" },
                { "father_of", @"
                    CREATE TABLE father_of (
                        start_id VARCHAR2(20),
                        end_id VARCHAR2(20),
                        PRIMARY KEY (start_id, end_id),
                        FOREIGN KEY (start_id) REFERENCES persons(id),
                        FOREIGN KEY (end_id) REFERENCES persons(id)
                    )" },
                { "mother_of", @"
                    CREATE TABLE mother_of (
                        start_id VARCHAR2(20),
                        end_id VARCHAR2(20),
                        PRIMARY KEY (start_id, end_id),
                        FOREIGN KEY (start_id) REFERENCES persons(id),
                        FOREIGN KEY (end_id) REFERENCES persons(id)
                    )" },
                { "influenced_by", @"
                    CREATE TABLE influenced_by (
                        start_id VARCHAR2(20),
                        end_id VARCHAR2(20),
                        PRIMARY KEY (start_id, end_id),
                        FOREIGN KEY (start_id) REFERENCES persons(id),
                        FOREIGN KEY (end_id) REFERENCES persons(id)
                    )" },
                { "partner_of", @"
                    CREATE TABLE partner_of (
                        start_id VARCHAR2(20),
                        end_id VARCHAR2(20),
                        PRIMARY KEY (start_id, end_id),
                        FOREIGN KEY (start_id) REFERENCES persons(id),
                        FOREIGN KEY (end_id) REFERENCES persons(id)
                    )" },
                { "person_to_award", @"
                    CREATE TABLE person_to_award (
                        start_id VARCHAR2(20),
                        end_id VARCHAR2(20),
                        PRIMARY KEY (start_id, end_id),
                        FOREIGN KEY (start_id) REFERENCES persons(id),
                        FOREIGN KEY (end_id) REFERENCES awards(id)
                    )" },
                { "person_to_birth_in", @"
                    CREATE TABLE person_to_birth_in (
                        start_id VARCHAR2(20),
                        end_id VARCHAR2(20),
                        PRIMARY KEY (start_id, end_id),
                        FOREIGN KEY (start_id) REFERENCES persons(id),
                        FOREIGN KEY (end_id) REFERENCES places(id)
                    )" },
                { "person_to_died_in", @"
                    CREATE TABLE person_to_died_in (
                        start_id VARCHAR2(20),
                        end_id VARCHAR2(20),
                        PRIMARY KEY (start_id, end_id),
                        FOREIGN KEY (start_id) REFERENCES persons(id),
                        FOREIGN KEY (end_id) REFERENCES places(id)
                    )" },
                { "person_to_national_of", @"
                    CREATE TABLE person_to_national_of (
                        start_id VARCHAR2(20),
                        end_id VARCHAR2(20),
                        PRIMARY KEY (start_id, end_id),
                        FOREIGN KEY (start_id) REFERENCES persons(id),
                        FOREIGN KEY (end_id) REFERENCES places(id)
                    )" },
                { "relative_of", @"
                    CREATE TABLE relative_of (
                        start_id VARCHAR2(20),
                        end_id VARCHAR2(20),
                        PRIMARY KEY (start_id, end_id),
                        FOREIGN KEY (start_id) REFERENCES persons(id),
                        FOREIGN KEY (end_id) REFERENCES persons(id)
                    )" },
                { "significant_person_for", @"
                    CREATE TABLE significant_person_for (
                        start_id VARCHAR2(20),
                        end_id VARCHAR2(20),
                        PRIMARY KEY (start_id, end_id),
                        FOREIGN KEY (start_id) REFERENCES persons(id),
                        FOREIGN KEY (end_id) REFERENCES persons(id)
                    )" },
                { "student_of", @"
                    CREATE TABLE student_of (
                        start_id VARCHAR2(20),
                        end_id VARCHAR2(20),
                        PRIMARY KEY (start_id, end_id),
                        FOREIGN KEY (start_id) REFERENCES persons(id),
                        FOREIGN KEY (end_id) REFERENCES persons(id)
                    )" }
            };

            foreach (var table in edgeTables)
            {
                try
                {
                    using var command = new OracleCommand(table.Value, connection);
                    await command.ExecuteNonQueryAsync();
                    Console.WriteLine($"Created edge table {table.Key} successfully");
                }
                catch (OracleException ex) when (ex.Number == 955)
                {
                    Console.WriteLine($"Edge table {table.Key} already exists");
                }
            }
        }

        // Clear existing data from tables
        public async Task ClearAllTables()
        {
            using var connection = new OracleConnection(_oracleConnectionString);
            await connection.OpenAsync();

            var tables = new[]
            {
                "person_workplaces", "person_to_work", "person_to_field", "person_to_occupation",
                "persons", "works", "awards", "places", "workplaces", "fields", "occupations"
            };

            foreach (var table in tables)
            {
                try
                {
                    using var command = new OracleCommand($"DELETE FROM {table}", connection);
                    var rowsDeleted = await command.ExecuteNonQueryAsync();
                    Console.WriteLine($"Cleared {rowsDeleted} rows from {table}");
                }
                catch (OracleException ex) when (ex.Number == 942) // ORA-00942: table or view does not exist
                {
                    Console.WriteLine($"Table {table} does not exist, skipping clear");
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"Error clearing table {table}: {ex.Message}");
                }
            }
        }

        // Import data with proper date handling and duplicate handling
        public async Task ImportDataFromCsv(string csvPath, string tableName)
        {
            // Check if file exists
            if (!File.Exists(csvPath))
            {
                Console.WriteLine($"CSV file not found: {csvPath}");
                return;
            }

            // For edge tables referencing persons, load all valid person IDs
            HashSet<string> personIds = null;
            if (tableName == "advisor_of" || tableName == "father_of" || tableName == "mother_of" || tableName == "influenced_by" || tableName == "partner_of" || tableName == "relative_of" || tableName == "significant_person_for" || tableName == "student_of" || tableName == "person_workplaces" || tableName == "person_to_work" || tableName == "person_to_field" || tableName == "person_to_occupation")
            {
                var personsPath = Path.Combine(Path.GetDirectoryName(csvPath)!, "..", "nodes", "persons.csv");
                personIds = new HashSet<string>();
                if (File.Exists(personsPath))
                {
                    using var personReader = new StreamReader(personsPath);
                    using var personCsv = new CsvHelper.CsvReader(personReader, System.Globalization.CultureInfo.InvariantCulture);
                    personCsv.Read();
                    personCsv.ReadHeader();
                    while (personCsv.Read())
                    {
                        var id = personCsv.GetField("id");
                        if (!string.IsNullOrWhiteSpace(id))
                            personIds.Add(id);
                    }
                }
            }

            using var connection = new OracleConnection(_oracleConnectionString);
            await connection.OpenAsync();

            using var reader = new StreamReader(csvPath);
            using var csv = new CsvHelper.CsvReader(reader, System.Globalization.CultureInfo.InvariantCulture);
            var records = csv.GetRecords<dynamic>().ToList();
            var batchSize = 1000;
            var totalRecords = records.Count;
            var processedRecords = 0;
            var skippedRecords = 0;

            Console.WriteLine($"Starting import of {totalRecords} records to {tableName}");

            for (var i = 0; i < totalRecords; i += batchSize)
            {
                var batch = records.Skip(i).Take(batchSize);
                using var transaction = connection.BeginTransaction();

                try
                {
                    foreach (var record in batch)
                    {
                        var dict = (IDictionary<string, object>)record;
                        // Filter for edge tables referencing persons
                        if (personIds != null && dict.ContainsKey("start_id") && dict.ContainsKey("end_id"))
                        {
                            var startId = dict["start_id"]?.ToString();
                            var endId = dict["end_id"]?.ToString();
                            if (!personIds.Contains(startId) || !personIds.Contains(endId))
                            {
                                skippedRecords++;
                                continue; // skip this row
                            }
                        }
                        var properties = dict.Keys
                            .Where(k => !k.StartsWith(":") && k != ":LABEL" && k != ":TYPE")
                            .ToList();
                        var columns = string.Join(", ", properties);
                        var values = string.Join(", ", properties.Select(p => $":{p}"));
                        var insertCommand = $"INSERT INTO {tableName} ({columns}) VALUES ({values})";
                        using var command = new OracleCommand(insertCommand, connection);
                        command.Transaction = transaction;
                        foreach (var property in properties)
                        {
                            var value = dict[property];
                            if (value != null)
                            {
                                if (property.EndsWith("_date"))
                                {
                                    if (DateTime.TryParseExact(value.ToString(), "MM/dd/yyyy HH:mm:ss", System.Globalization.CultureInfo.InvariantCulture, System.Globalization.DateTimeStyles.None, out DateTime dateValue))
                                    {
                                        command.Parameters.Add($":{property}", dateValue);
                                    }
                                    else
                                    {
                                        command.Parameters.Add($":{property}", DBNull.Value);
                                    }
                                }
                                else
                                {
                                    command.Parameters.Add($":{property}", value);
                                }
                            }
                            else
                            {
                                command.Parameters.Add($":{property}", DBNull.Value);
                            }
                        }
                        try
                        {
                            await command.ExecuteNonQueryAsync();
                            processedRecords++;
                        }
                        catch (OracleException ex) when (ex.Number == 1) // ORA-00001: unique constraint violated
                        {
                            skippedRecords++;
                            continue;
                        }
                    }
                    await transaction.CommitAsync();
                    Console.WriteLine($"Imported batch: {processedRecords} processed, {skippedRecords} skipped");
                }
                catch (Exception ex)
                {
                    await transaction.RollbackAsync();
                    Console.WriteLine($"Error importing batch to {tableName}: {ex.Message}");
                    throw;
                }
            }
            Console.WriteLine($"Completed import to {tableName}: {processedRecords} records imported, {skippedRecords} duplicates or missing persons skipped");
        }

        // Create property graph with proper vertex and edge definitions
        public async Task CreatePropertyGraph()
        {
            using var connection = new OracleConnection(_oracleConnectionString);
            await connection.OpenAsync();

            try
            {
                // Drop existing graph if it exists
                var dropGraphCommand = "BEGIN EXECUTE IMMEDIATE 'DROP PROPERTY GRAPH knowledge_graph'; EXCEPTION WHEN OTHERS THEN NULL; END;";
                using (var dropCommand = new OracleCommand(dropGraphCommand, connection))
                {
                    await dropCommand.ExecuteNonQueryAsync();
                }

                var createGraphCommand = @"
                    CREATE PROPERTY GRAPH knowledge_graph
                    VERTEX TABLES (
                        persons 
                            KEY (id) 
                            LABEL Person 
                            PROPERTIES (name, birth_date, death_date, gender, description),
                        works 
                            KEY (id) 
                            LABEL Work 
                            PROPERTIES (name),
                        workplaces 
                            KEY (id) 
                            LABEL Workplace 
                            PROPERTIES (name),
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
                        person_workplaces 
                            SOURCE KEY (start_id) REFERENCES persons(id)
                            DESTINATION KEY (end_id) REFERENCES workplaces(id)
                            LABEL WORKED_AT
                            PROPERTIES (start_date, end_date),
                        person_to_work 
                            SOURCE KEY (start_id) REFERENCES persons(id)
                            DESTINATION KEY (end_id) REFERENCES works(id)
                            LABEL CREATED,
                        person_to_field 
                            SOURCE KEY (start_id) REFERENCES persons(id)
                            DESTINATION KEY (end_id) REFERENCES fields(id)
                            LABEL SPECIALIZED_IN,
                        person_to_occupation 
                            SOURCE KEY (start_id) REFERENCES persons(id)
                            DESTINATION KEY (end_id) REFERENCES occupations(id)
                            LABEL HAS_OCCUPATION
                    )";

                using var createCommand = new OracleCommand(createGraphCommand, connection);
                await createCommand.ExecuteNonQueryAsync();
                Console.WriteLine("Property graph created successfully");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error creating property graph: {ex.Message}");
                throw;
            }
        }


        // Import a single person's data
        public async Task ImportPersonData(Person person)
        {
            using var connection = new OracleConnection(_oracleConnectionString);
            await connection.OpenAsync();

            using var transaction = connection.BeginTransaction();
            try
            {
                // Insert person
                var insertPersonCommand = @"
                    INSERT INTO persons (id, name, birth_date, death_date, gender, description)
                    VALUES (:id, :name, :birth_date, :death_date, :gender, :description)";

                using (var command = new OracleCommand(insertPersonCommand, connection))
                {
                    command.Transaction = transaction;
                    command.Parameters.Add(":id", person.Id);
                    command.Parameters.Add(":name", person.Name);
                    command.Parameters.Add(":birth_date", person.BirthDate);
                    command.Parameters.Add(":death_date", person.DeathDate);
                    command.Parameters.Add(":gender", person.Gender);
                    command.Parameters.Add(":description", person.Description);
                    await command.ExecuteNonQueryAsync();
                }

                // Insert fields
                foreach (var field in person.Fields)
                {
                    var insertFieldCommand = @"
                        INSERT INTO fields (id, name)
                        VALUES (:id, :name)";

                    using (var command = new OracleCommand(insertFieldCommand, connection))
                    {
                        command.Transaction = transaction;
                        command.Parameters.Add(":id", field.Name);
                        command.Parameters.Add(":name", field.Name);
                        await command.ExecuteNonQueryAsync();
                    }

                    var insertPersonFieldCommand = @"
                        INSERT INTO person_to_field (start_id, end_id)
                        VALUES (:start_id, :end_id)";

                    using (var command = new OracleCommand(insertPersonFieldCommand, connection))
                    {
                        command.Transaction = transaction;
                        command.Parameters.Add(":start_id", person.Id);
                        command.Parameters.Add(":end_id", field.Name);
                        await command.ExecuteNonQueryAsync();
                    }
                }

                // Insert workplaces
                foreach (var workplace in person.Workplaces)
                {
                    var insertWorkplaceCommand = @"
                        INSERT INTO workplaces (id, name)
                        VALUES (:id, :name)";

                    using (var command = new OracleCommand(insertWorkplaceCommand, connection))
                    {
                        command.Transaction = transaction;
                        command.Parameters.Add(":id", workplace.WorkplaceId);
                        command.Parameters.Add(":name", workplace.WorkplaceId);
                        await command.ExecuteNonQueryAsync();
                    }

                    var insertPersonWorkplaceCommand = @"
                        INSERT INTO person_workplaces (start_id, end_id, start_date, end_date)
                        VALUES (:start_id, :end_id, :start_date, :end_date)";

                    using (var command = new OracleCommand(insertPersonWorkplaceCommand, connection))
                    {
                        command.Transaction = transaction;
                        command.Parameters.Add(":start_id", person.Id);
                        command.Parameters.Add(":end_id", workplace.WorkplaceId);
                        command.Parameters.Add(":start_date", workplace.StartDate);
                        command.Parameters.Add(":end_date", workplace.EndDate);
                        await command.ExecuteNonQueryAsync();
                    }
                }

                await transaction.CommitAsync();
            }
            catch (Exception)
            {
                await transaction.RollbackAsync();
                throw;
            }
        }

        // Import all CSV data from Exported/Memgraph/nodes and edges
        public async Task ImportAllCsvData(string basePath)
        {
            // Node tables
            var nodeFiles = new Dictionary<string, string>
            {
                { "persons", Path.Combine(basePath, "nodes", "persons.csv") },
                { "works", Path.Combine(basePath, "nodes", "works.csv") },
                { "awards", Path.Combine(basePath, "nodes", "awards.csv") },
                { "places", Path.Combine(basePath, "nodes", "places.csv") },
                { "workplaces", Path.Combine(basePath, "nodes", "workplaces.csv") },
                { "fields", Path.Combine(basePath, "nodes", "fields.csv") },
                { "occupations", Path.Combine(basePath, "nodes", "occupations.csv") }
            };
            foreach (var kv in nodeFiles)
            {
                if (File.Exists(kv.Value))
                {
                    await ImportDataFromCsv(kv.Value, kv.Key);
                }
            }

            // Edge tables (mapping start_id/end_id to source_id/target_id)
            var edgeFiles = new Dictionary<string, string>
            {
                { "advisor_of", Path.Combine(basePath, "edges", "advisor_of.csv") },
                { "father_of", Path.Combine(basePath, "edges", "father_of.csv") },
                { "mother_of", Path.Combine(basePath, "edges", "mother_of.csv") },
                { "influenced_by", Path.Combine(basePath, "edges", "influenced_by.csv") },
                { "partner_of", Path.Combine(basePath, "edges", "partner_of.csv") },
                { "person_to_award", Path.Combine(basePath, "edges", "person_to_award.csv") },
                { "person_to_birth_in", Path.Combine(basePath, "edges", "person_to_birth_in.csv") },
                { "person_to_died_in", Path.Combine(basePath, "edges", "person_to_died_in.csv") },
                { "person_to_national_of", Path.Combine(basePath, "edges", "person_to_national_of.csv") },
                { "relative_of", Path.Combine(basePath, "edges", "relative_of.csv") },
                { "significant_person_for", Path.Combine(basePath, "edges", "significant_person_for.csv") },
                { "student_of", Path.Combine(basePath, "edges", "student_of.csv") },
                { "person_to_work", Path.Combine(basePath, "edges", "person_to_work.csv") },
                { "person_workplaces", Path.Combine(basePath, "edges", "person_workplaces.csv") },
                { "person_to_occupation", Path.Combine(basePath, "edges", "person_to_occupation.csv") },
                { "person_to_field", Path.Combine(basePath, "edges", "person_to_field.csv") }
            };
            foreach (var kv in edgeFiles)
            {
                if (File.Exists(kv.Value))
                {
                    // Read and rewrite CSV to map start_id/end_id to source_id/target_id if needed
                    var tempPath = Path.GetTempFileName();
                    using (var reader = new StreamReader(kv.Value))
                    using (var writer = new StreamWriter(tempPath))
                    {
                        var header = reader.ReadLine();
                        if (header != null && (header.Contains("start_id") || header.Contains("end_id")))
                        {
                            header = header.Replace("start_id", "start_id").Replace("end_id", "end_id");
                        }
                        writer.WriteLine(header);
                        while (!reader.EndOfStream)
                        {
                            writer.WriteLine(reader.ReadLine());
                        }
                    }
                    await ImportDataFromCsv(tempPath, kv.Key);
                    File.Delete(tempPath);
                }
            }
        }
    }
} 