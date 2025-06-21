using System;
using System.Text.Json;
using System.Collections.Generic;
using System.Threading.Tasks;
using System.Linq;
using App.Models;

namespace App.Database
{
    public static class WikidataEntityMapper
    {
        public static async Task<Person> Map(JsonElement entity, string entityId, WikidataLabelService? labelService = null)
        {
            var person = new Person
            {
                Id = entityId,
                Name = GetLabel(entity, "en") ?? string.Empty,
                Description = GetDescription(entity, "en"),
                BirthDate = GetDate(entity, "P569"),
                DeathDate = GetDate(entity, "P570"),
                Gender = GetGender(entity),
                ImageURL = GetImageUrl(entity),
                Education = GetEducation(entity),
                Religion = GetReligion(entity),
                Nationality = GetNationality(entity),
                PlaceOfBirth = GetPlaceOfBirth(entity),
                PlaceOfDeath = GetPlaceOfDeath(entity),
                Country = GetCountry(entity),
                Fields = GetFields(entity),
                Occupations = GetOccupations(entity),
                Awards = GetAwards(entity),
                NotableWorks = labelService == null ? new List<Item>() : await GetNotableWorks(entity, labelService),
                Workplaces = GetWorkplaces(entity)
            };
            return person;
        }

        public static string? GetLabel(JsonElement entity, string language)
        {
            try 
            { 
                if (entity.TryGetProperty("labels", out var labels) && 
                    labels.TryGetProperty(language, out var lang) && 
                    lang.TryGetProperty("value", out var value))
                {
                    return value.GetString();
                }
                return null;
            } 
            catch { return null; }
        }
        public static string? GetDescription(JsonElement entity, string language)
        {
            try 
            { 
                if (entity.TryGetProperty("descriptions", out var descriptions) && 
                    descriptions.TryGetProperty(language, out var lang) && 
                    lang.TryGetProperty("value", out var value))
                {
                    return value.GetString();
                }
                return null;
            } 
            catch { return null; }
        }
        public static DateTime? GetDate(JsonElement entity, string propertyId)
        {
            try
            {
                if (!entity.TryGetProperty("claims", out var claimsObj) || !claimsObj.TryGetProperty(propertyId, out var claims))
                    return null;
                if (claims.ValueKind == JsonValueKind.Undefined || claims.ValueKind == JsonValueKind.Null || claims.ValueKind != JsonValueKind.Array || claims.GetArrayLength() == 0) return null;
                var mainSnak = claims[0].GetProperty("mainsnak");
                var datavalue = mainSnak.GetProperty("datavalue").GetProperty("value");
                var time = datavalue.GetProperty("time").GetString();
                return DateTime.Parse(time.Replace("+", "").Split("T")[0]);
            }
            catch { return null; }
        }
        public static string? GetGender(JsonElement entity)
        {
            try
            {
                var claims = entity.GetProperty("claims").GetProperty("P21");
                if (claims.ValueKind == JsonValueKind.Undefined || claims.ValueKind == JsonValueKind.Null || claims.ValueKind != JsonValueKind.Array || claims.GetArrayLength() == 0) return null;
                var mainSnak = claims[0].GetProperty("mainsnak");
                var datavalue = mainSnak.GetProperty("datavalue").GetProperty("value");
                var id = datavalue.GetProperty("id").GetString();
                return id == "Q6581097" ? "Male" : id == "Q6581072" ? "Female" : "Other";
            }
            catch { return null; }
        }
        public static string? GetImageUrl(JsonElement entity)
        {
            try
            {
                var claims = entity.GetProperty("claims").GetProperty("P18");
                if (claims.ValueKind == JsonValueKind.Undefined || claims.ValueKind == JsonValueKind.Null || claims.ValueKind != JsonValueKind.Array || claims.GetArrayLength() == 0) return null;
                var mainSnak = claims[0].GetProperty("mainsnak");
                var datavalue = mainSnak.GetProperty("datavalue").GetProperty("value").GetString();
                return $"https://commons.wikimedia.org/wiki/Special:FilePath/{datavalue}";
            }
            catch { return null; }
        }
        public static string? GetEducation(JsonElement entity)
        {
            try
            {
                var claims = entity.GetProperty("claims").GetProperty("P69");
                if (claims.ValueKind == JsonValueKind.Undefined || claims.ValueKind == JsonValueKind.Null || claims.ValueKind != JsonValueKind.Array || claims.GetArrayLength() == 0) return null;
                var mainSnak = claims[0].GetProperty("mainsnak");
                var datavalue = mainSnak.GetProperty("datavalue").GetProperty("value");
                return datavalue.GetProperty("id").GetString();
            }
            catch { return null; }
        }
        public static string? GetReligion(JsonElement entity)
        {
            try
            {
                var claims = entity.GetProperty("claims").GetProperty("P140");
                if (claims.ValueKind == JsonValueKind.Undefined || claims.ValueKind == JsonValueKind.Null || claims.ValueKind != JsonValueKind.Array || claims.GetArrayLength() == 0) return null;
                var mainSnak = claims[0].GetProperty("mainsnak");
                var datavalue = mainSnak.GetProperty("datavalue").GetProperty("value");
                return datavalue.GetProperty("id").GetString();
            }
            catch { return null; }
        }
        public static string? GetNationality(JsonElement entity)
        {
            try
            {
                var claims = entity.GetProperty("claims").GetProperty("P27");
                if (claims.ValueKind == JsonValueKind.Undefined || claims.ValueKind == JsonValueKind.Null || claims.ValueKind != JsonValueKind.Array || claims.GetArrayLength() == 0) return null;
                var mainSnak = claims[0].GetProperty("mainsnak");
                var datavalue = mainSnak.GetProperty("datavalue").GetProperty("value");
                return datavalue.GetProperty("id").GetString();
            }
            catch { return null; }
        }
        public static string? GetPlaceOfBirth(JsonElement entity)
        {
            try
            {
                var claims = entity.GetProperty("claims").GetProperty("P19");
                if (claims.ValueKind == JsonValueKind.Undefined || claims.ValueKind == JsonValueKind.Null || claims.ValueKind != JsonValueKind.Array || claims.GetArrayLength() == 0) return null;
                var mainSnak = claims[0].GetProperty("mainsnak");
                var datavalue = mainSnak.GetProperty("datavalue").GetProperty("value");
                return datavalue.GetProperty("id").GetString();
            }
            catch { return null; }
        }
        public static string? GetPlaceOfDeath(JsonElement entity)
        {
            try
            {
                var claims = entity.GetProperty("claims").GetProperty("P20");
                if (claims.ValueKind == JsonValueKind.Undefined || claims.ValueKind == JsonValueKind.Null || claims.ValueKind != JsonValueKind.Array || claims.GetArrayLength() == 0) return null;
                var mainSnak = claims[0].GetProperty("mainsnak");
                var datavalue = mainSnak.GetProperty("datavalue").GetProperty("value");
                return datavalue.GetProperty("id").GetString();
            }
            catch { return null; }
        }
        public static string? GetCountry(JsonElement entity)
        {
            try
            {
                var claims = entity.GetProperty("claims").GetProperty("P27");
                if (claims.ValueKind == JsonValueKind.Undefined || claims.ValueKind == JsonValueKind.Null || claims.ValueKind != JsonValueKind.Array || claims.GetArrayLength() == 0) return null;
                var mainSnak = claims[0].GetProperty("mainsnak");
                var datavalue = mainSnak.GetProperty("datavalue").GetProperty("value");
                return datavalue.GetProperty("id").GetString();
            }
            catch { return null; }
        }
        public static List<Field> GetFields(JsonElement entity)
        {
            var fields = new List<Field>();
            try
            {
                var claims = entity.GetProperty("claims").GetProperty("P101");
                foreach (var claim in claims.EnumerateArray())
                {
                    var mainSnak = claim.GetProperty("mainsnak");
                    var datavalue = mainSnak.GetProperty("datavalue").GetProperty("value");
                    var id = datavalue.GetProperty("id").GetString();
                    if (id != null)
                    {
                        fields.Add(new Field { Name = id });
                    }
                }
            }
            catch { }
            return fields;
        }
        public static List<Occupation> GetOccupations(JsonElement entity)
        {
            var occupations = new List<Occupation>();
            try
            {
                var claims = entity.GetProperty("claims").GetProperty("P106");
                foreach (var claim in claims.EnumerateArray())
                {
                    var mainSnak = claim.GetProperty("mainsnak");
                    var datavalue = mainSnak.GetProperty("datavalue").GetProperty("value");
                    var id = datavalue.GetProperty("id").GetString();
                    if (id != null)
                    {
                        occupations.Add(new Occupation { Name = id });
                    }
                }
            }
            catch { }
            return occupations;
        }
        public static List<string> GetAwards(JsonElement entity)
        {
            var awards = new List<string>();
            try
            {
                var claims = entity.GetProperty("claims").GetProperty("P166");
                foreach (var claim in claims.EnumerateArray())
                {
                    var mainSnak = claim.GetProperty("mainsnak");
                    var datavalue = mainSnak.GetProperty("datavalue").GetProperty("value");
                    var id = datavalue.GetProperty("id").GetString();
                    if (id != null)
                    {
                        awards.Add(id);
                    }
                }
            }
            catch { }
            return awards;
        }
        public static async Task<List<Item>> GetNotableWorks(JsonElement entity, WikidataLabelService? labelService)
        {
            var works = new List<Item>();
            var ids = new List<string>();
            try
            {
                var claims = entity.GetProperty("claims").GetProperty("P800");
                foreach (var claim in claims.EnumerateArray())
                {
                    var mainSnak = claim.GetProperty("mainsnak");
                    var datavalue = mainSnak.GetProperty("datavalue").GetProperty("value");
                    var id = datavalue.GetProperty("id").GetString();
                    if (id != null && id.StartsWith("Q"))
                    {
                        ids.Add(id);
                    }
                }
            }
            catch { }
            var labelDict = labelService != null ? await labelService.GetLabelsForIdsAsync(ids) : new Dictionary<string, string>();
            foreach (var id in ids)
            {
                works.Add(new Item { Id = id, Label = labelDict.GetValueOrDefault(id, id) });
            }
            return works;
        }
        public static List<WorkplaceRelation> GetWorkplaces(JsonElement entity)
        {
            var workplaces = new List<WorkplaceRelation>();
            try
            {
                if (!entity.TryGetProperty("claims", out var claimsObj))
                    return workplaces;

                if (!claimsObj.TryGetProperty("P108", out var claims) || claims.ValueKind != JsonValueKind.Array)
                    return workplaces;

                foreach (var claim in claims.EnumerateArray())
                {
                    try
                    {
                        if (!claim.TryGetProperty("mainsnak", out var mainSnak) ||
                            !mainSnak.TryGetProperty("datavalue", out var datavalue) ||
                            !datavalue.TryGetProperty("value", out var value) ||
                            !value.TryGetProperty("id", out var idElement))
                            continue;

                        var workplaceId = idElement.GetString();
                        if (string.IsNullOrWhiteSpace(workplaceId))
                            continue;

                        var workplace = new WorkplaceRelation { WorkplaceId = workplaceId };

                        // Try to get start date (P580)
                        if (claim.TryGetProperty("qualifiers", out var qualifiers) && 
                            qualifiers.TryGetProperty("P580", out var startDateQualifiers) &&
                            startDateQualifiers.ValueKind == JsonValueKind.Array)
                        {
                            foreach (var startDateQual in startDateQualifiers.EnumerateArray())
                            {
                                try
                                {
                                    if (startDateQual.TryGetProperty("datavalue", out var startDateValue) &&
                                        startDateValue.TryGetProperty("value", out var startValue) &&
                                        startValue.TryGetProperty("time", out var startTime))
                                    {
                                        var startDateStr = startTime.GetString();
                                        if (!string.IsNullOrEmpty(startDateStr) && 
                                            DateTime.TryParse(startDateStr.Replace("+", "").Split("T")[0], out var startDate))
                                        {
                                            workplace.StartDate = startDate;
                                            break;
                                        }
                                    }
                                }
                                catch
                                {
                                    // Skip this start date if there's an error
                                    continue;
                                }
                            }
                        }

                        // Try to get end date (P582)
                        if (qualifiers.TryGetProperty("P582", out var endDateQualifiers) &&
                            endDateQualifiers.ValueKind == JsonValueKind.Array)
                        {
                            foreach (var endDateQual in endDateQualifiers.EnumerateArray())
                            {
                                try
                                {
                                    if (endDateQual.TryGetProperty("datavalue", out var endDateValue) &&
                                        endDateValue.TryGetProperty("value", out var endValue) &&
                                        endValue.TryGetProperty("time", out var endTime))
                                    {
                                        var endDateStr = endTime.GetString();
                                        if (!string.IsNullOrEmpty(endDateStr) && 
                                            DateTime.TryParse(endDateStr.Replace("+", "").Split("T")[0], out var endDate))
                                        {
                                            workplace.EndDate = endDate;
                                            break;
                                        }
                                    }
                                }
                                catch
                                {
                                    // Skip this end date if there's an error
                                    continue;
                                }
                            }
                        }

                        workplaces.Add(workplace);
                    }
                    catch (Exception ex)
                    {
                        // Skip this workplace claim silently
                        continue;
                    }
                }
            }
            catch (Exception ex)
            {
                // Skip workplace extraction errors silently
            }
            return workplaces;
        }
    }
} 