namespace App.Models
{
    public class Occupation
    {
        public string? OccupationId { get; set; }
        public string? OccupationName { get; set; }
        public List<string> RelatedTools { get; set; } = new();
        
        // Additional properties for compatibility with existing code
        public string? Id => OccupationId;
        public string? Name => OccupationName;
    }
} 