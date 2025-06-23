using System;
using System.Net.Http;
using System.Text.Json;
using System.Threading.Tasks;
using System.Collections.Generic;
using System.Linq;
using App.Models;
using System.IO;
using App.Export;

namespace App.Database
{
    public class DataFetcher1
    {
        private readonly HttpClient _client;
        private readonly WikidataRelationshipFetcher _relationshipFetcher;

        public DataFetcher1()
        {
            _client = new HttpClient();
            _relationshipFetcher = new WikidataRelationshipFetcher();
        }
  
        
        public async Task<Person?> GetDataAsync(string entityId, WikidataLabelService labelService)
        {
            var url = $"https://www.wikidata.org/w/api.php?action=wbgetentities&ids={entityId}&format=json&languages=en";

            try
            {
                var response = await _client.GetAsync(url);
                response.EnsureSuccessStatusCode();
                var content = await response.Content.ReadAsStringAsync();

                using JsonDocument document = JsonDocument.Parse(content);
                var root = document.RootElement;
                var entities = root.GetProperty("entities");
                var entity = entities.GetProperty(entityId);

                var person = await WikidataEntityMapper.Map(entity, entityId, labelService);
                person.RelatedPeople = await _relationshipFetcher.GetRelatedPeopleViaSparql(entityId);
                // Console.WriteLine($"{person.Name} ({person.Id}) workplaces: {person.Workplaces.Count}");
                return person;
            }
            catch (Exception ex)
            {
                // Console.WriteLine($"Error fetching data: {ex.Message}");
                return null;
            }
        }
        

        public async Task ExportAsync(Person person, Dictionary<string, string> labelDict)
        {
            string folder = Path.Combine("Exported", "Memgraph");
            Directory.CreateDirectory(folder);

            await CsvExporter.WritePersonMemgraphAsync(person, folder, labelDict);
            await CsvExporter.WriteFieldsMemgraphAsync(person, folder, labelDict);
            await CsvExporter.WriteWorksMemgraphAsync(person.Name, person.NotableWorks, folder);
            await CsvExporter.WriteRelationshipsMemgraphAsync(person, folder, labelDict);

            Console.WriteLine("✅ Exported to Memgraph-compatible CSV files.");
        }
    }
} 