using Blazor.IndexedDB;
using Blazor.IndexedDB.Models;
using Blazor.IndexedDB.Server.Components;
var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddRazorComponents()
    .AddInteractiveServerComponents().AddCircuitOptions(o => o.DetailedErrors = true);
builder.Services.AddIndexedDB(dbStore =>
{
    dbStore.DbName = "TheFactory";
    dbStore.Version = 9;

    dbStore.Stores.Add(new StoreSchema
    {
        Name = "Employees",
        PrimaryKey = new IndexSpec { Name = "id", KeyPath = "id", Auto = true },
        Indexes = [
                        new IndexSpec{Name="IndexFirstName", KeyPath = "firstName", Auto=false},
                        new IndexSpec{Name="IndexLastName", KeyPath = "lastName", Auto=false},
                        new IndexSpec{Name="IndexSSN", KeyPath = "ssn", Auto=false},
                        new IndexSpec{Name="bla", KeyPath = "bla", Auto=false},

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
