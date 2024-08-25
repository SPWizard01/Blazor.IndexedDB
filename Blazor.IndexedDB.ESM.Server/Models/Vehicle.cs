using Bogus;

namespace Blazor.IndexedDB.ESM.Server.Models
{
    public sealed class Vehicle
    {
        private static Faker fkr = new();

        public int? Id { get; set; }
        public string Model { get; set; } = fkr.Vehicle.Model();
        public string Make { get; set; } = fkr.Vehicle.Manufacturer();
        public string Type { get; set; } = fkr.Vehicle.Type();
        public string FuelType { get; set; } = fkr.Vehicle.Fuel();
        public string Vin { get; set; } = fkr.Vehicle.Vin();
        public List<string> Reviews { get; set; } = [.. fkr.Rant.Reviews("vehicle", 2)];
        public DateTimeOffset ReleaseYear { get; set; } = fkr.Date.BetweenOffset(DateTimeOffset.Now.AddYears(-20), DateTimeOffset.Now);
    }
}
