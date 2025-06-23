using System;
using System.Collections.Generic;
using System.IO;
using System.Text;
using System.Threading.Tasks;
using App.Models;
using System.Linq;
using CsvHelper;
using CsvHelper.Configuration;
using System.Globalization;
using Microsoft.Extensions.Configuration;
using System.Text.Json;

namespace App.Export
{
    public static class CsvExporter
    {
        // Memgraph
        public static async Task WritePersonMemgraphAsync(Person person, string folder, Dictionary<string, string> labelDict)
        {
            string path = Path.Combine(folder, "nodes", "persons.csv");
            Directory.CreateDirectory(Path.GetDirectoryName(path)!);

            bool writeHeader = !File.Exists(path) || new FileInfo(path).Length == 0;
            using var writer = new StreamWriter(path, append: true);
            if (writeHeader)
                await writer.WriteLineAsync("id,name,birth_date,death_date,gender,description,image_url");

            string csvRow = string.Join(",",
                Escape(person.Id),
                Escape(person.Name),
                person.BirthDate?.ToString("yyyy-MM-dd") ?? "",
                person.DeathDate?.ToString("yyyy-MM-dd") ?? "",
                Escape(person.Gender),
                Escape(person.Description),
                Escape(person.ImageURL)
            );
            await writer.WriteLineAsync(csvRow);
        }

        public static async Task WriteFieldsMemgraphAsync(Person person, string folder, Dictionary<string, string> labelDict)
        {
            string nodePath = Path.Combine(folder, "nodes", "fields.csv");
            string edgePath = Path.Combine(folder, "edges", "person_to_field.csv");
            Directory.CreateDirectory(Path.GetDirectoryName(nodePath)!);
            Directory.CreateDirectory(Path.GetDirectoryName(edgePath)!);

            bool writeNodeHeader = !File.Exists(nodePath) || new FileInfo(nodePath).Length == 0;
            bool writeEdgeHeader = !File.Exists(edgePath) || new FileInfo(edgePath).Length == 0;

            using var nodeWriter = new StreamWriter(nodePath, append: true);
            using var edgeWriter = new StreamWriter(edgePath, append: true);

            if (writeNodeHeader) await nodeWriter.WriteLineAsync("id,name");
            if (writeEdgeHeader) await edgeWriter.WriteLineAsync("start_id,end_id");

            foreach (var field in person.Fields?.DistinctBy(f => f.Name) ?? Enumerable.Empty<Field>())
            {
                if (field.Name != null)
                {
                    var label = ((IReadOnlyDictionary<string?, string?>)labelDict).GetValueOrDefault(field.Name, field.Name);
                    await nodeWriter.WriteLineAsync($"{field.Name},{Escape(label)}");
                    await edgeWriter.WriteLineAsync($"{person.Id},{field.Name}");
                }
            }
        }

        public static async Task WriteWorksMemgraphAsync(string personId, List<NotableWork> works, string folder)
        {
            string nodePath = Path.Combine(folder, "nodes", "works.csv");
            string edgePath = Path.Combine(folder, "edges", "person_to_work.csv");
            Directory.CreateDirectory(Path.GetDirectoryName(nodePath)!);
            Directory.CreateDirectory(Path.GetDirectoryName(edgePath)!);

            bool writeNodeHeader = !File.Exists(nodePath) || new FileInfo(nodePath).Length == 0;
            bool writeEdgeHeader = !File.Exists(edgePath) || new FileInfo(edgePath).Length == 0;

            using var nodeWriter = new StreamWriter(nodePath, append: true);
            using var edgeWriter = new StreamWriter(edgePath, append: true);

            if (writeNodeHeader) await nodeWriter.WriteLineAsync("id,name");
            if (writeEdgeHeader) await edgeWriter.WriteLineAsync("start_id,end_id");

            foreach (var work in works.DistinctBy(w => w.WorkId))
            {
                await nodeWriter.WriteLineAsync($"{work.WorkId},{Escape(work.WorkName)}");
                await edgeWriter.WriteLineAsync($"{personId},{work.WorkId}");
            }
        }

        public static async Task WriteRelationshipsMemgraphAsync(Person person, string folder, Dictionary<string, string> labelDict)
        {
            // Canonical relationship type mapping and file naming
            var canonicalMap = new Dictionary<string, (string FileName, string Type)>(StringComparer.OrdinalIgnoreCase)
            {
                { "WAS_A_STUDENT_OF", ("student_of.csv", "STUDENT_OF") },
                { "WAS_THE_DOCTORAL_ADVISOR_OF", ("advisor_of.csv", "ADVISED") },
                { "WAS_THE_FATHER_OF", ("father_of.csv", "FATHER_OF") },
                { "WAS_THE_MOTHER_OF", ("mother_of.csv", "MOTHER_OF") },
                { "WAS_THE_PARTNER_OF", ("partner_of.csv", "PARTNER_OF") },
                { "WAS_A_SIGNIFICANT_PERSON_FOR", ("significant_person_for.csv", "SIGNIFICANT_PERSON_FOR") },
                { "WAS_A_RELATIVE_OF", ("relative_of.csv", "RELATIVE_OF") },
                { "WAS_INFLUENCED_BY", ("influenced_by.csv", "INFLUENCED_BY") },
                { "INFLUENCED_BY", ("influenced_by.csv", "INFLUENCED_BY") },
                { "INFLUENCED", ("significant_person_for.csv", "SIGNIFICANT_PERSON_FOR") },
                { "ADVISED", ("advisor_of.csv", "ADVISED") },
                { "STUDENT_OF", ("student_of.csv", "STUDENT_OF") },
                { "PARTNER_OF", ("partner_of.csv", "PARTNER_OF") },
                { "RELATIVE_OF", ("relative_of.csv", "RELATIVE_OF") },
                { "FATHER_OF", ("father_of.csv", "FATHER_OF") },
                { "MOTHER_OF", ("mother_of.csv", "MOTHER_OF") },
                { "SIGNIFICANT_PERSON_FOR", ("significant_person_for.csv", "SIGNIFICANT_PERSON_FOR") }
            };

            foreach (var relatedPerson in person.RelatedPeople)
            {
                var rel = relatedPerson.Relation.Replace(" ", "_").Replace("-", "_").ToUpperInvariant();
                if (!canonicalMap.TryGetValue(rel, out var mapping))
                {
                    // fallback: skip or write to a generic file if desired
                    continue;
                }
                var path = Path.Combine(folder, "edges", mapping.FileName);
                Directory.CreateDirectory(Path.GetDirectoryName(path)!);
                bool writeHeader = !File.Exists(path) || new FileInfo(path).Length == 0;
                using var writer = new StreamWriter(path, append: true);
                if (writeHeader)
                    await writer.WriteLineAsync("start_id,end_id");
                await writer.WriteLineAsync($"{person.Id},{relatedPerson.Id}");
            }
        }

        public static async Task WriteOccupationsMemgraphAsync(List<Occupation> occupations, string folder, Dictionary<string, string> labelDict)
        {
            string path = Path.Combine(folder, "nodes", "occupations.csv");
            Directory.CreateDirectory(Path.GetDirectoryName(path)!);

            bool writeHeader = !File.Exists(path) || new FileInfo(path).Length == 0;
            using var writer = new StreamWriter(path, append: true);
            if (writeHeader)
                await writer.WriteLineAsync("id,name");

            if (occupations != null)
            {
                foreach (var occ in occupations.Where(o => !string.IsNullOrWhiteSpace(o.Name)).DistinctBy(o => o.Name))
                {
                    var label = ((IReadOnlyDictionary<string?, string?>)labelDict).GetValueOrDefault(occ.Name, occ.Name);
                    await writer.WriteLineAsync($"{occ.Id},{Escape(label)}");
                }
            }
        }

        public static async Task WriteAwardsMemgraphAsync(List<Award> awards, string folder, Dictionary<string, string> labelDict)
        {
            string path = Path.Combine(folder, "nodes", "awards.csv");
            Directory.CreateDirectory(Path.GetDirectoryName(path)!);

            bool writeHeader = !File.Exists(path) || new FileInfo(path).Length == 0;
            using var writer = new StreamWriter(path, append: true);
            if (writeHeader)
                await writer.WriteLineAsync("id,name");

            foreach (var award in awards.Where(a => !string.IsNullOrWhiteSpace(a.AwardName)).DistinctBy(a => a.AwardName))
            {
                var label = ((IReadOnlyDictionary<string?, string?>)labelDict).GetValueOrDefault(award.AwardName, award.AwardName);
                await writer.WriteLineAsync($"{award.AwardId},{Escape(label)}");
            }
        }

        public static async Task WriteInstitutionsMemgraphAsync(string? educationQid, string folder, Dictionary<string, string> labelDict)
        {
            if (string.IsNullOrWhiteSpace(educationQid)) return;
            string path = Path.Combine(folder, "nodes", "institutions.csv");
            Directory.CreateDirectory(Path.GetDirectoryName(path)!);

            bool writeHeader = !File.Exists(path) || new FileInfo(path).Length == 0;
            using var writer = new StreamWriter(path, append: true);
            if (writeHeader)
                await writer.WriteLineAsync("id,name");

            var label = ((IReadOnlyDictionary<string?, string?>)labelDict).GetValueOrDefault(educationQid, educationQid);
            await writer.WriteLineAsync($"{educationQid},{Escape(label)}");
        }

        public static async Task WriteReligionsMemgraphAsync(string? religionQid, string folder, Dictionary<string, string> labelDict)
        {
            if (string.IsNullOrWhiteSpace(religionQid)) return;
            string path = Path.Combine(folder, "nodes", "religions.csv");
            Directory.CreateDirectory(Path.GetDirectoryName(path)!);

            bool writeHeader = !File.Exists(path) || new FileInfo(path).Length == 0;
            using var writer = new StreamWriter(path, append: true);
            if (writeHeader)
                await writer.WriteLineAsync("id,name");

            var label = ((IReadOnlyDictionary<string?, string?>)labelDict).GetValueOrDefault(religionQid, religionQid);
            await writer.WriteLineAsync($"{religionQid},{Escape(label)}");
        }

        public static async Task WritePlacesMemgraphAsync(IEnumerable<string?> placeQids, string folder, Dictionary<string, string> labelDict, string type)
        {
            string nodePath = Path.Combine(folder, "nodes", "places.csv");
            Directory.CreateDirectory(Path.GetDirectoryName(nodePath)!);

            bool writeNodeHeader = !File.Exists(nodePath) || new FileInfo(nodePath).Length == 0;

            using var nodeWriter = new StreamWriter(nodePath, append: true);

            if (writeNodeHeader) await nodeWriter.WriteLineAsync("id,name");

            foreach (var qid in placeQids.Where(q => !string.IsNullOrWhiteSpace(q)).Distinct())
            {
                var label = ((IReadOnlyDictionary<string?, string?>)labelDict).GetValueOrDefault(qid, qid);
                await nodeWriter.WriteLineAsync($"{qid},{Escape(label)}");
            }
        }

        public static async Task WritePersonPlaceEdgesAsync(IEnumerable<Person> people, string folder)
        {
            var files = new Dictionary<string, string>
            {
                { "BIRTH_IN", Path.Combine(folder, "edges", "person_to_birth_in.csv") },
                { "DIED_IN", Path.Combine(folder, "edges", "person_to_died_in.csv") },
                { "NATIONAL_OF", Path.Combine(folder, "edges", "person_to_national_of.csv") }
            };

            // Track which files have had their header written
            var headerWritten = new Dictionary<string, bool>
            {
                { "BIRTH_IN", false },
                { "DIED_IN", false },
                { "NATIONAL_OF", false }
            };

            foreach (var type in files.Keys)
            {
                var path = files[type];
                Directory.CreateDirectory(Path.GetDirectoryName(path)!);
                if (!File.Exists(path) || new FileInfo(path).Length == 0)
                {
                    using var writer = new StreamWriter(path, append: true);
                    await writer.WriteLineAsync("start_id,end_id");
                }
                headerWritten[type] = true;
            }

            foreach (var person in people)
            {
                if (!string.IsNullOrWhiteSpace(person.PlaceOfBirth))
                {
                    var path = files["BIRTH_IN"];
                    using var writer = new StreamWriter(path, append: true);
                    await writer.WriteLineAsync($"{person.Id},{person.PlaceOfBirth}");
                }
                if (!string.IsNullOrWhiteSpace(person.PlaceOfDeath))
                {
                    var path = files["DIED_IN"];
                    using var writer = new StreamWriter(path, append: true);
                    await writer.WriteLineAsync($"{person.Id},{person.PlaceOfDeath}");
                }
                if (!string.IsNullOrWhiteSpace(person.Nationality))
                {
                    var path = files["NATIONAL_OF"];
                    using var writer = new StreamWriter(path, append: true);
                    await writer.WriteLineAsync($"{person.Id},{person.Nationality}");
                }
            }
        }

        public static async Task WritePersonsMemgraphAsync(List<Person> persons, string folder, Dictionary<string, string> labelDict)
        {
            var path = Path.Combine(folder, "nodes", "persons.csv");
            Directory.CreateDirectory(Path.GetDirectoryName(path)!);
            using var writer = new StreamWriter(path);
            using var csv = new CsvWriter(writer, CultureInfo.InvariantCulture);
            
            csv.WriteField("id");
            csv.WriteField("name");
            csv.WriteField("birth_date");
            csv.WriteField("death_date");
            csv.WriteField("gender");
            csv.WriteField("description");
            await csv.NextRecordAsync();

            foreach (var person in persons)
            {
                csv.WriteField(person.Id);
                csv.WriteField(person.Name);
                csv.WriteField(person.BirthDate);
                csv.WriteField(person.DeathDate);
                csv.WriteField(person.Gender);
                csv.WriteField(person.Description);
                await csv.NextRecordAsync();
            }
        }

        public static async Task WriteFieldsBatchAsync(IEnumerable<string> fieldQids, string folder, Dictionary<string, string> labelDict)
        {
            var path = Path.Combine(folder, "nodes", "fields.csv");
            Directory.CreateDirectory(Path.GetDirectoryName(path)!);
            using var writer = new StreamWriter(path);
            using var csv = new CsvWriter(writer, CultureInfo.InvariantCulture);
            
            csv.WriteField("id");
            csv.WriteField("name");
            await csv.NextRecordAsync();

            foreach (var qid in fieldQids)
            {
                csv.WriteField(qid);
                csv.WriteField(labelDict.GetValueOrDefault(qid, qid));
                await csv.NextRecordAsync();
            }
        }

        public static async Task WriteOccupationsBatchAsync(IEnumerable<string> occupationQids, string folder, Dictionary<string, string> labelDict)
        {
            string path = Path.Combine(folder, "nodes", "occupations.csv");
            Directory.CreateDirectory(Path.GetDirectoryName(path)!);
            bool writeHeader = !File.Exists(path) || new FileInfo(path).Length == 0;
            using var writer = new StreamWriter(path, append: true);
            if (writeHeader) await writer.WriteLineAsync("id,name");
            foreach (var qid in occupationQids)
            {
                var label = ((IReadOnlyDictionary<string?, string?>)labelDict).GetValueOrDefault(qid, qid);
                await writer.WriteLineAsync($"{qid},{Escape(label)}");
            }
        }

        public static async Task WritePersonToFieldEdgesAsync(IEnumerable<Person> persons, string folder)
        {
            string path = Path.Combine(folder, "edges", "person_to_field.csv");
            Directory.CreateDirectory(Path.GetDirectoryName(path)!);
            bool writeHeader = !File.Exists(path) || new FileInfo(path).Length == 0;
            using var writer = new StreamWriter(path, append: true);
            if (writeHeader) await writer.WriteLineAsync("start_id,end_id");
            foreach (var person in persons)
            {
                foreach (var field in person.Fields)
                {
                    await writer.WriteLineAsync($"{person.Id},{field.Name}");
                }
            }
        }

        public static async Task WritePersonToInstitutionEdgesAsync(IEnumerable<Person> persons, string folder)
        {
            string path = Path.Combine(folder, "edges", "person_to_institution.csv");
            Directory.CreateDirectory(Path.GetDirectoryName(path)!);

            bool writeHeader = !File.Exists(path) || new FileInfo(path).Length == 0;
            using var writer = new StreamWriter(path, append: true);
            if (writeHeader)
                await writer.WriteLineAsync("start_id,end_id,start_date,end_date");

            foreach (var person in persons)
            {
                if (person.Workplaces != null)
                {
                    foreach (var wp in person.Workplaces)
                    {
                        string start = wp.StartDate?.ToString("yyyy-MM-dd") ?? "";
                        string end = wp.EndDate?.ToString("yyyy-MM-dd") ?? "";
                        await writer.WriteLineAsync($"{person.Id},{wp.WorkplaceId},{start},{end}");
                    }
                }
            }
        }

        public static async Task WriteWorkplacesMemgraphAsync(List<Person> persons, string folder, Dictionary<string, string> labelDict)
        {
            var path = Path.Combine(folder, "nodes", "workplaces.csv");
            Directory.CreateDirectory(Path.GetDirectoryName(path)!);
            using var writer = new StreamWriter(path);
            using var csv = new CsvWriter(writer, CultureInfo.InvariantCulture);
            
            csv.WriteField("id");
            csv.WriteField("name");
            await csv.NextRecordAsync();

            var workplaces = persons
                .SelectMany(p => p.Workplaces)
                .Select(w => w.WorkplaceId)
                .Where(q => !string.IsNullOrWhiteSpace(q))
                .Distinct();

            foreach (var qid in workplaces)
            {
                csv.WriteField(qid);
                csv.WriteField(labelDict.GetValueOrDefault(qid!, qid));
                await csv.NextRecordAsync();
            }
        }

        public static async Task WritePersonWorkplaceEdgesAsync(List<Person> persons, string folder)
        {
            var path = Path.Combine(folder, "edges", "person_workplaces.csv");
            Directory.CreateDirectory(Path.GetDirectoryName(path)!);
            using var writer = new StreamWriter(path);
            using var csv = new CsvWriter(writer, CultureInfo.InvariantCulture);
            
            csv.WriteField("start_id");
            csv.WriteField("end_id");
            csv.WriteField("start_date");
            csv.WriteField("end_date");
            await csv.NextRecordAsync();

            foreach (var person in persons)
            {
                foreach (var workplace in person.Workplaces)
                {
                    if (!string.IsNullOrWhiteSpace(workplace.WorkplaceId))
                    {
                        csv.WriteField(person.Id);
                        csv.WriteField(workplace.WorkplaceId);
                        csv.WriteField(workplace.StartDate);
                        csv.WriteField(workplace.EndDate);
                        await csv.NextRecordAsync();
                    }
                }
            }
        }

        public static async Task WritePersonToAwardEdgesAsync(IEnumerable<Person> persons, string folder)
        {
            string path = Path.Combine(folder, "edges", "person_to_award.csv");
            Directory.CreateDirectory(Path.GetDirectoryName(path)!);

            bool writeHeader = !File.Exists(path) || new FileInfo(path).Length == 0;
            using var writer = new StreamWriter(path, append: true);
            if (writeHeader)
                await writer.WriteLineAsync("start_id,end_id");

            foreach (var person in persons)
            {
                if (person.Awards != null)
                {
                    foreach (var award in person.Awards.Where(a => !string.IsNullOrWhiteSpace(a.AwardId)))
                    {
                        await writer.WriteLineAsync($"{person.Id},{award.AwardId}");
                    }
                }
            }
        }

        public static async Task WritePersonToOccupationEdgesAsync(IEnumerable<Person> persons, string folder)
        {
            string path = Path.Combine(folder, "edges", "person_to_occupation.csv");
            Directory.CreateDirectory(Path.GetDirectoryName(path)!);

            bool writeHeader = !File.Exists(path) || new FileInfo(path).Length == 0;
            using var writer = new StreamWriter(path, append: true);
            if (writeHeader)
                await writer.WriteLineAsync("start_id,end_id");

            foreach (var person in persons)
            {
                if (person.Occupations != null)
                {
                    foreach (var occupation in person.Occupations.Where(o => !string.IsNullOrWhiteSpace(o.Id)))
                    {
                        await writer.WriteLineAsync($"{person.Id},{occupation.Id}");
                    }
                }
            }
        }

        private static string Escape(string? value)
        {
            if (string.IsNullOrEmpty(value)) return "";
            if (value.Contains(",") || value.Contains("\""))
                return $"\"{value.Replace("\"", "\"\"")}\"";
            return value;
        }
    }

    public class AppSettings
    {
        public ConnectionStrings ConnectionStrings { get; set; }
    }

    public class ConnectionStrings
    {
        public required string Memgraph { get; set; }
        public required string Oracle { get; set; }
    }
} 