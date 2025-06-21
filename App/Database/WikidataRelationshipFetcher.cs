using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Text.Json;
using System.Threading.Tasks;
using System.Linq;
using App.Models;
using App.Export;

namespace App.Database
{
    public class WikidataRelationshipFetcher
    {
        public async Task<List<RelatedPerson>> GetRelatedPeopleViaSparql(string entityId)
        {
            // Canonical relationship map: propertyId => (label, subjectIsSource, allowBothDirections)
            var canonicalMap = new Dictionary<string, (string Label, bool SubjectIsSource, bool AllowBothDirections)>
            {
                ["P184"] = ("was the doctoral advisor of", true, true),   // Show both advisor and student
                ["P185"] = ("was a student of", false, true),             // Show both student and advisor
                ["P25"]  = ("was the mother of", true, false),
                ["P22"]  = ("was the father of", true, false),
                ["P1038"] = ("was a relative of", true, true),            // Symmetric
                ["P451"] = ("was the partner of", true, true),            // Symmetric
                ["P737"] = ("was influenced by", false, false),
                ["P3342"] = ("was a significant person for", false, false)
            };

            var endpoint = "https://query.wikidata.org/sparql";
            var sparql = $@"
                SELECT ?person ?personLabel ?relation ?relationLabel ?direction WHERE {{
                  {{
                    wd:{entityId} ?relation ?person .
                    BIND(true AS ?direction)
                    ?person wdt:P31 wd:Q5 .
                  }}
                  UNION
                  {{
                    ?person ?relation wd:{entityId} .
                    BIND(false AS ?direction)
                    ?person wdt:P31 wd:Q5 .
                  }}
                  SERVICE wikibase:label {{ bd:serviceParam wikibase:language 'en'. }}
                }}
                LIMIT 100
            ";
            var url = $"{endpoint}?query={Uri.EscapeDataString(sparql)}&format=json";
            var client = new HttpClient();
            client.DefaultRequestHeaders.UserAgent.ParseAdd("Knowledge_Graph/1.0 (knowledge_graph@gmail.com)");
            var response = await client.GetAsync(url);
            response.EnsureSuccessStatusCode();
            var content = await response.Content.ReadAsStringAsync();
            using var doc = JsonDocument.Parse(content);
            var results = doc.RootElement.GetProperty("results").GetProperty("bindings");
            var people = new List<RelatedPerson>();
            var seen = new HashSet<string>();
            foreach (var result in results.EnumerateArray())
            {
                var personUriProp = result.GetProperty("person").GetProperty("value");
                var personUri = personUriProp.GetString();
                if (string.IsNullOrWhiteSpace(personUri)) continue;
                var personId = personUri.Split('/').Last();
                var relationUriProp = result.GetProperty("relation").GetProperty("value");
                var relationUri = relationUriProp.GetString();
                if (string.IsNullOrWhiteSpace(relationUri)) continue;
                var propertyId = relationUri.Split('/').Last();

                string? personLabel = null;
                if (result.TryGetProperty("personLabel", out var personLabelProp) &&
                    personLabelProp.TryGetProperty("value", out var personLabelValue))
                {
                    personLabel = personLabelValue.GetString();
                }

                var isSubject = result.TryGetProperty("direction", out var dirProp) && dirProp.GetProperty("value").GetString() == "true";

                if (!canonicalMap.TryGetValue(propertyId, out var canonical))
                    continue; // skip unknown properties
                bool isDirectionCorrect = (canonical.SubjectIsSource == isSubject);
                bool allowBoth = canonical.AllowBothDirections;

                // Only include canonical direction, unless both directions are allowed
                if (!allowBoth && !isDirectionCorrect)
                    continue;

                string relationLabel = canonical.Label;

                // Deduplicate
                string source = isSubject ? entityId : personId;
                string target = isSubject ? personId : entityId;
                string dedupKey = $"{source}-{target}-{propertyId}";
                if (!string.IsNullOrEmpty(dedupKey) && seen.Contains(dedupKey)) continue;
                if (!string.IsNullOrEmpty(dedupKey)) seen.Add(dedupKey);

                if (!string.IsNullOrWhiteSpace(personLabel) && !string.IsNullOrWhiteSpace(relationLabel))
                {
                    people.Add(new RelatedPerson
                    {
                        Id = personId,
                        Name = personLabel,
                        Relation = relationLabel,
                        IsSubject = isSubject,
                        PropertyId = propertyId
                    });
                }
            }
            return people;
        }

        public Dictionary<string, List<string>> GroupRelationshipsByType(List<RelatedPerson> people, string subjectName)
        {
            var advisorProps = new HashSet<string> { "P184" };
            var studentProps = new HashSet<string> { "P185" };
            var familyProps = new HashSet<string> { "P22", "P25", "P40" };
            var relativeProps = new HashSet<string> { "P1038" };
            var partnerProps = new HashSet<string> { "P451" };
            var influenceProps = new HashSet<string> { "P737" };
            var significantProps = new HashSet<string> { "P3342" };

            var advisors = new List<string>();
            var students = new List<string>();
            var family = new List<string>();
            var partners = new HashSet<(string, string)>();
            var relatives = new HashSet<(string, string)>();
            var influence = new List<string>();
            var significant = new List<string>();
            var other = new List<string>();
            var seen = new HashSet<string>();

            string MergeNames(string a, string b) => string.Compare(a, b) < 0 ? $"{a} and {b}" : $"{b} and {a}";

            foreach (var p in people)
            {
                string key = $"{p.Id}-{p.PropertyId}-{p.Relation}-{p.IsSubject}";
                if (seen.Contains(key)) continue;
                seen.Add(key);

                string line = p.IsSubject
                    ? $"{p.Name ?? ""} {p.Relation ?? ""} {subjectName ?? ""}"
                    : $"{subjectName ?? ""} {p.Relation ?? ""} {p.Name ?? ""}";

                if (!string.IsNullOrEmpty(p.PropertyId) && advisorProps.Contains(p.PropertyId))
                {
                    if (p.IsSubject)
                        advisors.Add(line);
                }
                else if (!string.IsNullOrEmpty(p.PropertyId) && studentProps.Contains(p.PropertyId))
                {
                    if (!p.IsSubject)
                        students.Add(line);
                }
                else if (!string.IsNullOrEmpty(p.PropertyId) && familyProps.Contains(p.PropertyId))
                {
                    if (!family.Contains(line))
                        family.Add(line);
                }
                else if (!string.IsNullOrEmpty(p.PropertyId) && partnerProps.Contains(p.PropertyId) && !string.IsNullOrEmpty(p.Name) && !string.IsNullOrEmpty(subjectName))
                {
                    var pair = (p.Name ?? "", subjectName ?? "");
                    var pairKey = MergeNames(p.Name ?? "", subjectName ?? "");
                    if (!partners.Any(x => MergeNames(x.Item1, x.Item2) == pairKey))
                        partners.Add(pair);
                }
                else if (!string.IsNullOrEmpty(p.PropertyId) && relativeProps.Contains(p.PropertyId) && !string.IsNullOrEmpty(p.Name) && !string.IsNullOrEmpty(subjectName))
                {
                    var pair = (p.Name ?? "", subjectName ?? "");
                    var pairKey = MergeNames(p.Name ?? "", subjectName ?? "");
                    if (!relatives.Any(x => MergeNames(x.Item1, x.Item2) == pairKey))
                        relatives.Add(pair);
                }
                else if (!string.IsNullOrEmpty(p.PropertyId) && influenceProps.Contains(p.PropertyId))
                {
                    if (!influence.Contains(line))
                        influence.Add(line);
                }
                else if (!string.IsNullOrEmpty(p.PropertyId) && significantProps.Contains(p.PropertyId))
                {
                    if (!significant.Contains(line))
                        significant.Add(line);
                }
                else
                {
                    if (!other.Contains(line))
                        other.Add(line);
                }
            }

            var result = new Dictionary<string, List<string>>
            {
                { "Advisors", advisors },
                { "Students", students },
                { "Family", family },
                { "Partners", partners.Select(x => $"{MergeNames(x.Item1, x.Item2)} were partners").ToList() },
                { "Relatives", relatives.Select(x => $"{MergeNames(x.Item1, x.Item2)} were relatives").ToList() },
                { "Influence", influence },
                { "Significant", significant },
                { "Other", other }
            };
            return result;
        }
    }
} 