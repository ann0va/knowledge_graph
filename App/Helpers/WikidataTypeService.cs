using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Text.Json;
using System.Threading.Tasks;

namespace App.Helpers
{
    public static class WikidataTypeService
    {
        public static async Task<Dictionary<string, string>> GetEntityTypesBatchAsync(IEnumerable<string> qids)
        {
            var typeMap = new Dictionary<string, string>();
            var qidList = qids.Where(q => !string.IsNullOrWhiteSpace(q)).Distinct().ToList();
            if (!qidList.Any()) return typeMap;

            // Build VALUES clause
            var values = string.Join(" ", qidList.Select(q => $"wd:{q}"));
            var sparql = $@"
                SELECT ?item ?typeLabel WHERE {{
                  VALUES ?item {{ {values} }}
                  ?item wdt:P31 ?type .
                  SERVICE wikibase:label {{ bd:serviceParam wikibase:language 'en'. }}
                }}";
            var url = $"https://query.wikidata.org/sparql?query={Uri.EscapeDataString(sparql)}&format=json";
            using var client = new HttpClient();
            client.DefaultRequestHeaders.UserAgent.ParseAdd("Knowledge_Graph/1.0 (knowledge_graph@gmail.com)");
            var response = await client.GetAsync(url);
            response.EnsureSuccessStatusCode();
            var content = await response.Content.ReadAsStringAsync();
            using var doc = JsonDocument.Parse(content);
            var results = doc.RootElement.GetProperty("results").GetProperty("bindings");
            foreach (var result in results.EnumerateArray())
            {
                var itemProp = result.GetProperty("item").GetProperty("value");
                var itemUri = itemProp.GetString();
                if (string.IsNullOrWhiteSpace(itemUri)) continue;
                var qid = itemUri.Split('/').Last();
                string? typeLabel = null;
                if (result.TryGetProperty("typeLabel", out var typeLabelProp) &&
                    typeLabelProp.TryGetProperty("value", out var valueProp))
                {
                    typeLabel = valueProp.GetString();
                }
                if (qid != null && typeLabel != null)
                    typeMap[qid] = typeLabel;
            }
            return typeMap;
        }

        public static string ClassifyType(string typeLabel)
        {
            var placeTypes = new HashSet<string> { "city", "country", "town", "village", "suburb", "municipality", "state" };
            var workplaceTypes = new HashSet<string> { "university", "company", "organization", "school", "institute" };

            if (typeLabel == null) return "Unknown";
            var lower = typeLabel.ToLowerInvariant();
            if (placeTypes.Contains(lower)) return "Place";
            if (workplaceTypes.Contains(lower)) return "Workplace";
            return "Other";
        }
    }
} 