using Blazor.IndexedDB;
using Blazor.IndexedDB.Models;
using Blazor.IndexedDB.Server.Components;
using MudBlazor.Services;
var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddRazorComponents()
    .AddInteractiveServerComponents().AddCircuitOptions(o => o.DetailedErrors = true);
builder.Services.AddMudServices();
builder.Services.AddIndexedDB(dbStore =>
{
    dbStore.DbName = "TheFactory";
    dbStore.Version = 1;

    dbStore.Stores.Add(new StoreSchema
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
