namespace App.Models
{
    public class Field
    {
        public string? Name { get; set; }
        public string? Description { get; set; }
        public string? WorkWith { get; set; }
        public List<string> Subfields { get; set; } = new();
    }
} 