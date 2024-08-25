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
        public static IServiceCollection AddIndexedDB(this IServiceCollection services, Action<IndexedDBManagerConfig> options)
        {
            var indexedDBConfig = new IndexedDBManagerConfig()
            {
                Config = new IndexedDBNotificationConfig()
                {
                    SendNotifications = false,
                    SendNotificationsFromJS = false
                }
            };

            options(indexedDBConfig);

            services.TryAddSingleton(indexedDBConfig);
            services.AddScoped<IndexedDBManager>();

            return services;
        }
    }
}
