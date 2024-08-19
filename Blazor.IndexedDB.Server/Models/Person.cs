using Bogus;

namespace Blazor.IndexedDB.Server.Models
{
    public class Person
    {
        private static Faker fkr = new();
        public long? Id { get; set; }
        public string FirstName { get; set; } = fkr.Name.FirstName();
        public string LastName { get; set; } = fkr.Name.LastName();
        public long Ssn { get; set; } = fkr.Random.Long(1123456789);
        public string Blad { get; set; } = fkr.Rant.Review();
        public string Kp1 { get; set; } = fkr.Random.Word();
        public int Kp2 { get; set; } = fkr.Random.Number();
        public string[] Kp3 { get; set; } = fkr.Random.WordsArray(fkr.Random.Byte(1, 9));

    }
}
