using System;
using Neo4j.Driver;
using Newtonsoft.Json.Linq;
using Microsoft.Extensions.Configuration;

namespace App.Data;

public class MemgraphUploader
{
     private readonly IDriver _driver;

     public MemgraphUploader(IConfiguration configuration)
     {
          var connectionString = configuration.GetConnectionString("Memgraph");
          _driver = GraphDatabase.Driver(connectionString, AuthTokens.None);
     }


     public async Task UploadDataAsync(JArray data)
     {
          try
    {
        using (var session = _driver.AsyncSession())
        {
            await session.WriteTransactionAsync(async tx =>
            {
                // Create Alan Turing node
                var query = @"
                MERGE (p:Person {name: $name, birthDate: $birthDate, deathDate: $deathDate})
                MERGE (o:Occupation {name: $occupation})
                MERGE (f:Field {name: $fieldOfWork})
                MERGE (e:Institution {name: $educatedAt})
                MERGE (c:Country {name: $country})
                MERGE (advisor:Person {name: 'Alonzo Church'})  // Doctoral advisor
                MERGE (student:Person {name: 'Robin Gandy'})  // Student

                // Create relationships
                MERGE (p)-[:HAS_OCCUPATION]->(o)
                MERGE (p)-[:WORKS_IN]->(f)
                MERGE (p)-[:EDUCATED_AT]->(e)
                MERGE (p)-[:CITIZEN_OF]->(c)
                MERGE (p)-[:ADVISED_BY]->(advisor)
                MERGE (p)-[:MENTORED]->(student)";

                await tx.RunAsync(query, new 
                { 
                    name = "Alan Turing", 
                    birthDate = "1912-06-23", 
                    deathDate = "1954-06-07",
                    occupation = "Mathematician",
                    fieldOfWork = "Cryptanalysis",
                    educatedAt = "King's College, Cambridge",
                    country = "United Kingdom"
                });

                Console.WriteLine("Node with relationships created successfully.");
            });
        }
    }
    catch (Exception ex)
    {
        Console.WriteLine($"Error creating node: {ex.Message}");
    }
}

     public async Task UploadRelatedPeopleAsync(JArray relatedPeople)
     {
         try
    {
        using (var session = _driver.AsyncSession())
        {
            await session.WriteTransactionAsync(async tx =>
            {
                foreach (var person in relatedPeople)
                {
                    var query = @"
                    MERGE (p:Person {name: $name})
                    MERGE (turing:Person {name: 'Alan Turing'})  // Ensure Alan Turing node exists
                    MERGE (p)-[:RELATED_AS {type: $relation}]->(turing)";  // Create relationship

                    await tx.RunAsync(query, new 
                    { 
                        name = person["name"].ToString(), 
                        relation = person["relation"].ToString()
                    });

                    Console.WriteLine($"Node created: {person["name"]} - Related as {person["relation"]}");
                }
            });
        }
    }
    catch (Exception ex)
    {
        Console.WriteLine($"Error creating nodes and relationships: {ex.Message}");
    }
     }
}