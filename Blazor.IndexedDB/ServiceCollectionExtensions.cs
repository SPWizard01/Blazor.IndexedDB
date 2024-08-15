using Blazor.IndexedDB.Models;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using System;

namespace Blazor.IndexedDB
{
    public static class ServiceCollectionExtensions
    {
        /// <summary>
        /// Set up the DbStore and creates an instance IndexedDBManager as a singleton
        /// </summary>
        /// <param name="services"></param>
        /// <param name="options">Action to set up the DbStore</param>
        /// <returns></returns>
        public static IServiceCollection AddIndexedDB(this IServiceCollection services, Action<DbStore> options, bool serverSide = false)
        {
            var dbStore = new DbStore();
            options(dbStore);

            services.TryAddSingleton(dbStore);
            services.AddScoped<IndexedDBManager>();

            return services;
        }
    }
}
