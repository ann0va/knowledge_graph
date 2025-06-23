namespace App.Export
{
    public static class MemgraphCsvSchema
    {
        public const string PersonHeader = "id:ID,name,birth_date,death_date,gender,description";
        public const string FieldHeader = "person_id:ID,field_name";
        public const string RelationshipHeader = ":START_ID,:END_ID,relation_type";
    }
} 