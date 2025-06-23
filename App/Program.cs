using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using App.Database;
using App.Models;
using App.Data;
using App.Export;
using Microsoft.Extensions.Configuration;
using App.Data;
using App.Models;
using App.Export;

namespace App
{
    public class Program
    {
        public static async Task Main(string[] args)
        {

            
            // 1. Fetch the person (e.g., Alan Turing)
            var fetcher = new DataFetcher1();
            var labelService = new WikidataLabelService();
            var mainPerson = await fetcher.GetDataAsync("Q7251", labelService);
            if (mainPerson == null)
            {
                Console.WriteLine("Failed to fetch person data.");
                return;
            }
            

            // 2. Collect all unique person Q-IDs (main + related)
            var allPersonQids = new HashSet<string> { mainPerson.Id };
            foreach (var rel in mainPerson.RelatedPeople)
                if (!string.IsNullOrWhiteSpace(rel.Id))
                    allPersonQids.Add(rel.Id);

            // 3. Fetch all persons
            var allPersons = new List<Person> { mainPerson }; // Start with the main person
            foreach (var qid in allPersonQids)
            {
                if (qid != mainPerson.Id) // Skip the main person since we already added it
                {
                    var p = await fetcher.GetDataAsync(qid, labelService);
                    if (p != null)
                        allPersons.Add(p);
                }
            }

            // 4. Collect all Q-IDs for label lookup
            var allQids = new HashSet<string?>();
            foreach (var person in allPersons)
            {
                if (!string.IsNullOrWhiteSpace(person.Education)) allQids.Add(person.Education);
                if (!string.IsNullOrWhiteSpace(person.Religion)) allQids.Add(person.Religion);
                if (!string.IsNullOrWhiteSpace(person.Nationality)) allQids.Add(person.Nationality);
                if (!string.IsNullOrWhiteSpace(person.PlaceOfBirth)) allQids.Add(person.PlaceOfBirth);
                if (!string.IsNullOrWhiteSpace(person.PlaceOfDeath)) allQids.Add(person.PlaceOfDeath);
                if (!string.IsNullOrWhiteSpace(person.Country)) allQids.Add(person.Country);
                allQids.UnionWith(person.Fields.Select(f => f.Name));
                allQids.UnionWith(person.Occupations.Select(o => o.Name));
                allQids.UnionWith(person.Awards.Select(a => a.AwardName));
                allQids.UnionWith(person.NotableWorks.Select(w => w.WorkId));
                allQids.UnionWith(person.Workplaces.Select(w => w.WorkplaceId));
            }

            // 5. Fetch labels for all Q-IDs
            var labelDict = await labelService.GetLabelsForIdsAsync(allQids.Where(q => !string.IsNullOrWhiteSpace(q))!);

            // 6. Export to Memgraph format
            var exportPath = Path.Combine(Directory.GetCurrentDirectory(), "Exported", "Memgraph");
            await CsvExporter.WritePersonsMemgraphAsync(allPersons, exportPath, labelDict);
            
            var fields = allPersons
                .SelectMany(p => p.Fields)
                .Select(f => f.Name)
                .Where(q => !string.IsNullOrWhiteSpace(q))
                .Select(q => q!)
                .Distinct()
                .ToList();
            await CsvExporter.WriteFieldsBatchAsync(fields, exportPath, labelDict);

            var occupations = allPersons
                .SelectMany(p => p.Occupations)
                .Select(o => o.Name)
                .Where(q => !string.IsNullOrWhiteSpace(q))
                .Select(q => q!)
                .Distinct()
                .ToList();
            await CsvExporter.WriteOccupationsBatchAsync(occupations, exportPath, labelDict);

            await CsvExporter.WritePersonToFieldEdgesAsync(allPersons, exportPath);
            await CsvExporter.WritePersonToAwardEdgesAsync(allPersons, exportPath);
            await CsvExporter.WritePersonToOccupationEdgesAsync(allPersons, exportPath);
            await CsvExporter.WriteAwardsMemgraphAsync(allPersons.SelectMany(p => p.Awards).Where(a => !string.IsNullOrWhiteSpace(a.AwardId)).Distinct().ToList(), exportPath, labelDict);
            await CsvExporter.WritePlacesMemgraphAsync(allPersons.SelectMany(p => new[] { p.PlaceOfBirth, p.PlaceOfDeath, p.Nationality, p.Country }).Where(q => !string.IsNullOrWhiteSpace(q)).Distinct(), exportPath, labelDict, "Place");
            await CsvExporter.WriteWorkplacesMemgraphAsync(allPersons, exportPath, labelDict);
            await CsvExporter.WritePersonWorkplaceEdgesAsync(allPersons, exportPath);
            await CsvExporter.WritePersonPlaceEdgesAsync(allPersons, exportPath);
            foreach (var person in allPersons)
            {
                await CsvExporter.WriteWorksMemgraphAsync(person.Id, person.NotableWorks, exportPath);
                await CsvExporter.WriteRelationshipsMemgraphAsync(person, exportPath, labelDict);
                Console.WriteLine($"Occupations: {string.Join(", ", person.Occupations.Select(o => o.Name))}");
            }

            // 7. Export to Oracle using the new direct database approach
            var configuration = new ConfigurationBuilder()
                .SetBasePath(Directory.GetCurrentDirectory())
                .AddJsonFile("appsettings.json")
                .Build();

            var converter = new MemgraphToOracleConverter(configuration);

            try
            {
                // Clear existing data first
                Console.WriteLine("Clearing existing data from Oracle tables...");
                await converter.ClearAllTables();

                // Create tables
                await converter.CreateNodeTables();
                await converter.CreateEdgeTables();

                // Import node data
                string memgraphPath = Path.Combine(Directory.GetCurrentDirectory(), "Exported", "Memgraph");
                await converter.ImportDataFromCsv(Path.Combine(memgraphPath, "nodes", "persons.csv"), "persons");
                await converter.ImportDataFromCsv(Path.Combine(memgraphPath, "nodes", "works.csv"), "works");
                await converter.ImportDataFromCsv(Path.Combine(memgraphPath, "nodes", "awards.csv"), "awards");
                await converter.ImportDataFromCsv(Path.Combine(memgraphPath, "nodes", "places.csv"), "places");
                await converter.ImportDataFromCsv(Path.Combine(memgraphPath, "nodes", "workplaces.csv"), "workplaces");
                await converter.ImportDataFromCsv(Path.Combine(memgraphPath, "nodes", "fields.csv"), "fields");
                await converter.ImportDataFromCsv(Path.Combine(memgraphPath, "nodes", "occupations.csv"), "occupations");

                // Import edge data - using correct table names that match the database
                await converter.ImportDataFromCsv(Path.Combine(memgraphPath, "edges", "person_workplaces.csv"), "worked_at");
                await converter.ImportDataFromCsv(Path.Combine(memgraphPath, "edges", "person_to_work.csv"), "created");
                await converter.ImportDataFromCsv(Path.Combine(memgraphPath, "edges", "person_to_field.csv"), "works_in");
                await converter.ImportDataFromCsv(Path.Combine(memgraphPath, "edges", "person_to_occupation.csv"), "has_occupation");
                await converter.ImportDataFromCsv(Path.Combine(memgraphPath, "edges", "person_to_award.csv"), "received");
                await converter.ImportDataFromCsv(Path.Combine(memgraphPath, "edges", "person_to_birth_in.csv"), "birth_in");
                await converter.ImportDataFromCsv(Path.Combine(memgraphPath, "edges", "person_to_died_in.csv"), "died_in");
                await converter.ImportDataFromCsv(Path.Combine(memgraphPath, "edges", "person_to_national_of.csv"), "national_of");
                await converter.ImportDataFromCsv(Path.Combine(memgraphPath, "edges", "advisor_of.csv"), "advisor_of");
                await converter.ImportDataFromCsv(Path.Combine(memgraphPath, "edges", "father_of.csv"), "father_of");
                await converter.ImportDataFromCsv(Path.Combine(memgraphPath, "edges", "mother_of.csv"), "mother_of");
                await converter.ImportDataFromCsv(Path.Combine(memgraphPath, "edges", "partner_of.csv"), "partner_of");
                await converter.ImportDataFromCsv(Path.Combine(memgraphPath, "edges", "relative_of.csv"), "relative_of");
                await converter.ImportDataFromCsv(Path.Combine(memgraphPath, "edges", "student_of.csv"), "student_of");
                await converter.ImportDataFromCsv(Path.Combine(memgraphPath, "edges", "significant_person_for.csv"), "significant_person_for");

                // Create property graph
                await converter.CreatePropertyGraph();

                // Create PGQL property graph via SQLcl
                var sqlclExecutor = new SqlclPgqlExecutor(configuration);

                // Test SQLcl connection first
                Console.WriteLine("\n🔍 Testing SQLcl connection...");
                if (await sqlclExecutor.TestSqlclConnection())
                {
                    Console.WriteLine("\n🔧 Creating PGQL Property Graph through SQLcl...");
                    if (await sqlclExecutor.CreatePgqlPropertyGraph())
                    {
                        Console.WriteLine("\n📊 Executing sample PGQL queries...");
                        await sqlclExecutor.CreateGraphQueries();
                        
                        Console.WriteLine("\n📈 Getting visualization data...");
                        var visualizationData = await sqlclExecutor.GetGraphVisualizationData();
                        if (!string.IsNullOrEmpty(visualizationData))
                        {
                            Console.WriteLine("Visualization data retrieved successfully!");
                            Console.WriteLine("First 500 characters:");
                            Console.WriteLine(visualizationData.Substring(0, Math.Min(500, visualizationData.Length)));
                        }
                    }
                    else
                    {
                        Console.WriteLine("❌ Failed to create PGQL Property Graph");
                    }
                }
                else
                {
                    Console.WriteLine("❌ SQLcl is not available. Using only SQL Property Graph.");
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error: {ex.Message}");
                Console.WriteLine(ex.StackTrace);
            }

            Console.WriteLine("✅ Export completed successfully!");
        }
    }
}