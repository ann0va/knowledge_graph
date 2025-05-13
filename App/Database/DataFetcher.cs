using System;
using System.Net.Http;
using System.Threading.Tasks;
using Newtonsoft.Json.Linq;



namespace App.Database
{
    public class DataFetcher
    {
      
        private static readonly HttpClient _httpClient = new HttpClient();

        public async Task<JArray> FetchData()
        {
            string endpoint = "https://query.wikidata.org/sparql";
            string query = $@"
            SELECT ?person ?personLabel ?birthDate ?deathDate ?occupation ?fieldOfWork ?educatedAt ?country WHERE {{
    ?person wdt:P31 wd:Q5;  # Filter humans
            rdfs:label 'Alan Turing'@en;  # Get Alan Turing
            wdt:P569 ?birthDate;  # Birth date
            wdt:P570 ?deathDate;  # Death date
            wdt:P106 ?occupation;  # Occupation
            wdt:P101 ?fieldOfWork;  # Field of work
            wdt:P69 ?educatedAt;  # Education
            wdt:P27 ?country.  # Country of citizenship
    SERVICE wikibase:label {{ bd:serviceParam wikibase:language '[AUTO_LANGUAGE],en'. 
        ";
            
            string url = $"{endpoint}?query={Uri.EscapeDataString(query)}&format=json";
            using (HttpClient client = new HttpClient())
            {
                client.DefaultRequestHeaders.Add("User-Agent", "C# App");

                try
                {
                    HttpResponseMessage response = await client.GetAsync(url);
                    response.EnsureSuccessStatusCode();
                    string responseBody = await response.Content.ReadAsStringAsync();

                    JObject json = JObject.Parse(responseBody);
                    JArray results = new JArray();

                    foreach (var item in json["results"]["bindings"])
                    {
                        JObject person = new JObject
                        {
                            ["name"] = item["personLabel"]["value"].ToString(),
                            ["birthDate"] = item["birthDate"]["value"].ToString(),
                            ["deathDate"] = item["deathDate"]["value"].ToString(),
                            ["occupation"] = item["occupation"]["value"].ToString(),
                            ["fieldOfWork"] = item["fieldOfWork"]["value"].ToString(),
                            ["educatedAt"] = item["educatedAt"]["value"].ToString(),
                            ["country"] = item["country"]["value"].ToString()
                        };
                        results.Add(person);
                        Console.WriteLine($"Fetched: {person["name"]}");
                    }
                    return results;
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"Error fetching data: {ex.Message}");
                    return null;
                }
 
                
                
            }
        }

        public async Task<JArray> FetchRelatedPeople()
        {
             string endpoint = "https://query.wikidata.org/sparql";
        string query = @"
        SELECT ?person ?personLabel ?relation WHERE {
            VALUES ?turing { wd:Q7251 } # Alan Turing's Wikidata ID
            
            {
                ?person wdt:P184 ?turing.  # Doctoral student
                BIND('Student' AS ?relation)
            }
            UNION
            {
                ?person wdt:P185 ?turing.  # Doctoral advisor
                BIND('Advisor' AS ?relation)
            }
            UNION
            {
                ?person wdt:P1038 ?turing.  # Relative
                BIND('Relative' AS ?relation)
            }
            UNION
            {
                ?person wdt:P737 ?turing.  # Influenced by Alan Turing
                BIND('Influenced by' AS ?relation)
            }
            
            SERVICE wikibase:label { bd:serviceParam wikibase:language '[AUTO_LANGUAGE],en'. }
        }
        LIMIT 10";

        string url = $"{endpoint}?query={Uri.EscapeDataString(query)}&format=json";
        using (HttpClient client = new HttpClient())
        {
            client.DefaultRequestHeaders.Add("User-Agent", "C# App");

            try
            {
                HttpResponseMessage response = await client.GetAsync(url);
                response.EnsureSuccessStatusCode();
                string responseBody = await response.Content.ReadAsStringAsync();

                JObject json = JObject.Parse(responseBody);
                JArray results = new JArray();

                foreach (var item in json["results"]["bindings"])
                {
                    JObject person = new JObject
                    {
                        ["name"] = item["personLabel"]["value"].ToString(),
                        ["relation"] = item["relation"]["value"].ToString()
                    };
                    results.Add(person);
                    Console.WriteLine($"Fetched: {person["name"]} - Relation: {person["relation"]}");
                }
                return results;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error fetching data: {ex.Message}");
                return null;
            }
          }
        } 
    }
}

