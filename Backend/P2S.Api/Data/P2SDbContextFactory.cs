using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Microsoft.Extensions.Configuration;

namespace P2S.Api.Data;

/// <summary>
/// Used only by `dotnet ef` tooling to generate/apply migrations. Program.cs's own DbContext
/// registration calls ServerVersion.AutoDetect against a live connection at startup, which the
/// EF CLI can't satisfy when no MySQL server is reachable (e.g. generating a migration before
/// Docker/MySQL is running). This factory pins a fixed server version instead, so `dotnet ef`
/// never needs a live connection just to build the model.
/// </summary>
public class P2SDbContextFactory : IDesignTimeDbContextFactory<P2SDbContext>
{
    public P2SDbContext CreateDbContext(string[] args)
    {
        var configuration = new ConfigurationBuilder()
            .SetBasePath(Directory.GetCurrentDirectory())
            .AddJsonFile("appsettings.json", optional: true)
            .AddUserSecrets<Program>(optional: true)
            .Build();

        var connectionString = configuration.GetConnectionString("P2S")
            ?? "Server=127.0.0.1;Port=3306;Database=p2s_dev;User=root;Password=devpassword;";

        var optionsBuilder = new DbContextOptionsBuilder<P2SDbContext>();
        optionsBuilder.UseMySql(connectionString, new MySqlServerVersion(new Version(8, 0, 35)));

        return new P2SDbContext(optionsBuilder.Options);
    }
}
