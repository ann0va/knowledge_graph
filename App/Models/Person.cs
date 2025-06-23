namespace App.Models
{
    

    public class Person
    {
        public string Id { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }
        public DateTime? BirthDate { get; set; }
        public DateTime? DeathDate { get; set; }
        public string? Gender { get; set; }
        public string? ImageURL { get; set; }
        public string? Education { get; set; }
        public string? Religion { get; set; }
        public string? Nationality { get; set; }
        public string? PlaceOfBirth { get; set; }
        public string? PlaceOfDeath { get; set; }
        public string? Country { get; set; }
        public List<Field> Fields { get; set; } = new();
        public List<Occupation> Occupations { get; set; } = new();
        public List<Award> Awards { get; set; } = new();
        public List<NotableWork> NotableWorks { get; set; } = new();
        public List<RelatedPerson> RelatedPeople { get; set; } = new();
        public List<Workplace> Workplaces { get; set; } = new();

        public void AddWorkplace(Workplace workplace)
        {
            Workplaces.Add(workplace);
        }
    }


} 