using System;
using System.IO;
using System.Threading.Tasks;
using App.Models;
using Microsoft.Extensions.Configuration;

namespace App.Data
{
    public class OracleUploader
    {
        private readonly MemgraphToOracleConverter _converter;

        public OracleUploader(IConfiguration configuration)
        {
            _converter = new MemgraphToOracleConverter(configuration);
        }

        public async Task ExportAsync(Person person)
        {
            try
            {
                // Create tables if they don't exist
                await _converter.CreateNodeTables();
                await _converter.CreateEdgeTables();

                // Import person data
                await _converter.ImportPersonData(person);

                // Create property graph
                await _converter.CreatePropertyGraph();

                Console.WriteLine($"✅ Exported person data to Oracle successfully");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ Error exporting to Oracle: {ex.Message}");
                throw;
            }
        }
    }
}