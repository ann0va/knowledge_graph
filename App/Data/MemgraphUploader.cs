using System;
using System.IO;
using System.Threading.Tasks;
using System.Collections.Generic;
using System.Linq;
using App.Models;
using App.Export;

namespace App.Data;

public class MemgraphUploader
{
    public async Task ExportAsync(Person person, Dictionary<string, string> labelDict)
     {
        try
        {
            string exportPath = Path.Combine("Exported", "Memgraph");
            Directory.CreateDirectory(exportPath);

            await CsvExporter.WritePersonMemgraphAsync(person, exportPath, labelDict);
            await CsvExporter.WriteOccupationsMemgraphAsync(person.Occupations, exportPath, labelDict);
            await CsvExporter.WriteAwardsMemgraphAsync(person.Awards, exportPath, labelDict);
            await CsvExporter.WriteInstitutionsMemgraphAsync(person.Education, exportPath, labelDict);
            await CsvExporter.WriteReligionsMemgraphAsync(person.Religion, exportPath, labelDict);

            var places = new[] { person.PlaceOfBirth, person.PlaceOfDeath, person.Nationality, person.Country }
                .Where(p => !string.IsNullOrWhiteSpace(p))
                .ToList();
            await CsvExporter.WritePlacesMemgraphAsync(places, exportPath, labelDict, "Place");

            await CsvExporter.WriteFieldsMemgraphAsync(person, exportPath, labelDict);
            await CsvExporter.WriteWorksMemgraphAsync(person.Name, person.NotableWorks, exportPath);
            await CsvExporter.WriteRelationshipsMemgraphAsync(person, exportPath, labelDict);

            Console.WriteLine($"✅ Exported Memgraph CSV to: {exportPath}");
    }
    catch (Exception ex)
    {
            Console.WriteLine($"❌ Error exporting to Memgraph CSV: {ex.Message}");
    }
     }
}