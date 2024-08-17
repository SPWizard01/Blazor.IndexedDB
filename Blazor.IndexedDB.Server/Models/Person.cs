namespace Blazor.IndexedDB.Server.Models
{
    public class Person
    {
        public long? Id { get; set; }
        public string FirstName { get; set; }
        public string LastName { get; set; }
        public string Ssn { get; set; } = "Unknown";
        public string Blad { get; set; } = "Unknown";
        public string Kp1 { get; set; } = "Unknown";
        public int Kp2 { get; set; } = 123;
        public string[] Kp3 { get; set; } = [];

    }
}
