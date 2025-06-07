using System;
using System.IO;
using System.Threading.Tasks;
using App.Models;
using App.Export;

namespace App.Data
{
    public class OracleUploader
    {
        public async Task ExportAsync(Person person)
        {
            try
            {
                string exportPath = Path.Combine("Exported", "Oracle");
                Directory.CreateDirectory(exportPath);

                await CsvExporter.WritePersonOracleAsync(person, exportPath);
                await CsvExporter.WriteFieldsOracleAsync(person.Name, person.Fields, exportPath);
                await CsvExporter.WriteRelationshipsOracleAsync(person.RelatedPeople, exportPath);

                Console.WriteLine($"✅ Exported Oracle CSV to: {exportPath}");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ Error exporting to Oracle CSV: {ex.Message}");
            }
        }
    }
}