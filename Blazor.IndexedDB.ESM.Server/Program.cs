using Blazor.IndexedDB.ESM;
using Blazor.IndexedDB.ESM.Models;
using Blazor.IndexedDB.ESM.Server.Components;
using MudBlazor.Services;
var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddRazorComponents()
    //.AddInteractiveWebAssemblyComponents()
    .AddInteractiveServerComponents()
    .AddHubOptions(opts =>
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
    dbStore.Config.SendNotificationsFromJS = true;
    dbStore.Config.SendNotifications = true;
    var firstDb = new IndexedDBDatabase("TheFactory")
    {
        Version = 1
    };

    firstDb.Stores.Add(new IndexedDBStoreSchema
    {
        Name = "Employees",
        PrimaryKey = new IndexedDBIndex { Name = "id", KeyPath = ["id"], Auto = true },
        Indexes = [
                        new IndexedDBIndex{Name="IndexFirstName", KeyPath = ["firstName"]},
                        new IndexedDBIndex{Name="IndexLastName", KeyPath = ["lastName"]},
                        new IndexedDBIndex{Name="IndexSSN", KeyPath = ["ssn"], Unique=false},
                        new IndexedDBIndex{Name="IdxMulti", KeyPath = ["kp1","kp2"], MultiEntry = false},
                        new IndexedDBIndex{Name="IdxMultiTrue", KeyPath = ["kp3"], MultiEntry = true},
                    ]
    });
    var secondDb = new IndexedDBDatabase("VehicleFactory")
    {
        Version = 1
    };
    secondDb.Stores.Add(new IndexedDBStoreSchema
    {
        Name = "Vehicles",
        PrimaryKey = new IndexedDBIndex { Name = "id", KeyPath = ["id"], Auto = true },
        Indexes = [
                        new IndexedDBIndex{Name="IndexModel", KeyPath = ["model"]},
                        new IndexedDBIndex{Name="IndexMake", KeyPath = ["make"]},
                        new IndexedDBIndex{Name="IndexMakeArray", KeyPath = ["make"], KeepAsArrayOnSingleValue=true},
                        new IndexedDBIndex{Name="IndexType", KeyPath = ["type"], Unique=false},
                        new IndexedDBIndex{Name="IndexFuelType", KeyPath = ["fuelType"], Unique=false},
                        new IndexedDBIndex{Name="IndexVin", KeyPath = ["vin"], Unique=true},
                        new IndexedDBIndex{Name="IndexReleaseYear", KeyPath = ["releaseYear"], Unique=false},
                        new IndexedDBIndex{Name="IndexMakeModel", KeyPath = ["make","model"], Unique=false},
                        new IndexedDBIndex{Name="IndexReviews", KeyPath = ["reviews"], MultiEntry=true},
                    ]
    });
    dbStore.Databases.Add(firstDb);
    dbStore.Databases.Add(secondDb);
});
var app = builder.Build();

// Configure the HTTP request pipeline.
if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Error", createScopeForErrors: true);
    // The default HSTS value is 30 days. You may want to change this for production scenarios, see https://aka.ms/aspnetcore-hsts.
    app.UseHsts();
}
else
{
    //app.UseWebAssemblyDebugging();
}

app.UseHttpsRedirection();

app.UseStaticFiles();
app.UseAntiforgery();

app.MapRazorComponents<App>()
    .AddInteractiveServerRenderMode();
//.AddInteractiveWebAssemblyRenderMode();

app.Run();
