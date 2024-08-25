# Blazor.IndexedDB.ESM
Inspired By and based on [Tg.Blazor.IndexedDB](https://github.com/wtulloch/Blazor.IndexedDB)

Initial release of Blazor.IndexedDB.ESM
This library is a wrapper around IndexedDB to make it easier to use in Blazor applications.
Client side is built by [esbuild](https://esbuild.github.io/) and relies upon [idb](https://github.com/jakearchibald/idb)

When returning big data make sure to set 
```
.AddHubOptions(opts =>
{
    opts.MaximumReceiveMessageSize = 10 * 1024 * 1024; // 10MB
});
```
Otherwise you wont get any data returned in time.