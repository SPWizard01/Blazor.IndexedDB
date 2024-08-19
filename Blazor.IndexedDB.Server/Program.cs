using Blazor.IndexedDB;
using Blazor.IndexedDB.Models;
using Blazor.IndexedDB.Server.Components;
using MudBlazor.Services;
var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddRazorComponents()
    .AddInteractiveServerComponents().AddHubOptions(opts =>
    {
        opts.MaximumReceiveMessageSize = 10 * 1024 * 1024; // 10MB
    }).AddCircuitOptions(o =>
    {
        o.DetailedErrors = true;
        o.MaxBufferedUnacknowledgedRenderBatches = 10;
    });
builder.Services.AddMudServices();
builder.Services.AddIndexedDB(dbStore =>
{
    var firstDb = new IndexedDBDatabase("TheFactory")
    {
        Version = 1
    };

    firstDb.Stores.Add(new StoreSchema
    {
        Name = "Employees",
        PrimaryKey = new IndexSpec { Name = "id", KeyPath = ["id"], Auto = true },
        Indexes = [
                        new IndexSpec{Name="IndexFirstName", KeyPath = ["firstName"]},
                        new IndexSpec{Name="IndexLastName", KeyPath = ["lastName"]},
                        new IndexSpec{Name="IndexSSN", KeyPath = ["ssn"], Unique=false},
                        new IndexSpec{Name="IdxMulti", KeyPath = ["kp1","kp2"], MultiEntry = false},
                        new IndexSpec{Name="IdxMultiTrue", KeyPath = ["kp3"], MultiEntry = true},
                    ]
    });
    var secondDb = new IndexedDBDatabase("VehicleFactory")
    {
        Version = 1
    };
    secondDb.Stores.Add(new StoreSchema
    {
        Name = "Vehicles",
        PrimaryKey = new IndexSpec { Name = "id", KeyPath = ["id"], Auto = true },
        Indexes = [
                        new IndexSpec{Name="IndexModel", KeyPath = ["model"]},
                        new IndexSpec{Name="IndexMake", KeyPath = ["make"]},
                        new IndexSpec{Name="IndexMakeArray", KeyPath = ["make"], KeepAsArrayOnSingleValue=true},
                        new IndexSpec{Name="IndexType", KeyPath = ["type"], Unique=false},
                        new IndexSpec{Name="IndexFuelType", KeyPath = ["fuelType"], Unique=false},
                        new IndexSpec{Name="IndexVin", KeyPath = ["vin"], Unique=true},
                        new IndexSpec{Name="IndexReleaseYear", KeyPath = ["releaseYear"], Unique=false},
                        new IndexSpec{Name="IndexMakeModel", KeyPath = ["make","model"], Unique=false},
                        new IndexSpec{Name="IndexReviews", KeyPath = ["reviews"], MultiEntry=true},
                    ]
    });
    dbStore.Add(firstDb);
    dbStore.Add(secondDb);
});
var app = builder.Build();

// Configure the HTTP request pipeline.
if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Error", createScopeForErrors: true);
    // The default HSTS value is 30 days. You may want to change this for production scenarios, see https://aka.ms/aspnetcore-hsts.
    app.UseHsts();
}

app.UseHttpsRedirection();

app.UseStaticFiles();
app.UseAntiforgery();

app.MapRazorComponents<App>()
    .AddInteractiveServerRenderMode();

app.Run();
