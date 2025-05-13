using Neo4j.Driver;

namespace App.Database;

public class DataProcessor
{
    private readonly IDriver _driver;

    public DataProcessor(IDriver driver)
    {
        _driver = driver;
    }

    public async Task AddRelationshipAsync(string fromName, string toName, string relationType)
    {
        var query = @"
        MATCH (a:Person {name: $fromName})
        MATCH (b:Person {name: $toName})
        MERGE (a)-[r:RELATION {type: $relationType}]->(b)
";

        // Open a session and run the transaction
        using var session = _driver.AsyncSession();
        await session.WriteTransactionAsync(async tx =>
        {
            await tx.RunAsync(query, new { fromName = fromName, toName = toName, relationType = relationType });
        });
    }
}