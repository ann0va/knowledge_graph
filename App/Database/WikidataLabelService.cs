using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Text.Json;
using System.Threading.Tasks;
using System.Linq;

namespace App.Database
{
    public class WikidataLabelService
    {
        public async Task<Dictionary<string, string>> GetLabelsForIdsAsync(IEnumerable<string> ids)
        {
            var idList = ids.Where(id => !string.IsNullOrWhiteSpace(id)).Distinct().ToList();
            var labels = new Dictionary<string, string>();
            const int batchSize = 50;

            for (int i = 0; i < idList.Count; i += batchSize)
            {
                var batch = idList.Skip(i).Take(batchSize);
                var idString = string.Join("|", batch);
                var url = $"https://www.wikidata.org/w/api.php?action=wbgetentities&ids={idString}&format=json&languages=en";
                var client = new HttpClient();
                var response = await client.GetAsync(url);
                response.EnsureSuccessStatusCode();
                var content = await response.Content.ReadAsStringAsync();

                using JsonDocument document = JsonDocument.Parse(content);
                var root = document.RootElement;
                var entities = root.GetProperty("entities");
                foreach (var id in batch)
                {
                    if (entities.TryGetProperty(id, out var entity))
                    {
                        if (entity.TryGetProperty("labels", out var labelObj) &&
                            labelObj.TryGetProperty("en", out var enLabel) &&
                            enLabel.TryGetProperty("value", out var value))
                        {
                            var labelValue = value.GetString();
                            if (labelValue != null)
                                labels[id] = labelValue;
                        }
                    }
                }
            }
            return labels;
        }

        public async Task<string?> GetLabelForId(string id)
        {
            if (string.IsNullOrWhiteSpace(id)) return null;
            var url = $"https://www.wikidata.org/w/api.php?action=wbgetentities&ids={id}&format=json&languages=en";
            var client = new HttpClient();
            var response = await client.GetAsync(url);
            response.EnsureSuccessStatusCode();
            var content = await response.Content.ReadAsStringAsync();
            using JsonDocument document = JsonDocument.Parse(content);
            var root = document.RootElement;
            if (root.TryGetProperty("entities", out var entities) &&
                entities.TryGetProperty(id, out var entity) &&
                entity.TryGetProperty("labels", out var labelObj) &&
                labelObj.TryGetProperty("en", out var enLabel) &&
                enLabel.TryGetProperty("value", out var value))
            {
                return value.GetString();
            }
            return null;
        }
    }
} 