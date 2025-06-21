namespace App.Models
{
    public class RelatedPerson
    {
        public string? Id { get; set; }
        public string? Name { get; set; }
        public string? Relation { get; set; }
        public bool IsSubject { get; set; }
        public string? PropertyId { get; set; }
    }
} 