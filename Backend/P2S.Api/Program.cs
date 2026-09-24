using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using P2S.Api.Data;
using P2S.Api.Services;

var builder = WebApplication.CreateBuilder(args);

var connectionString = builder.Configuration.GetConnectionString("P2S")
    ?? throw new InvalidOperationException("Missing ConnectionStrings:P2S in configuration.");

// Detect the MySQL server version once at startup rather than inside the AddDbContext
// options lambda — that lambda re-runs for every scoped DbContext (i.e. almost every
// request), so detecting per-request opens a throwaway connection just to ask the
// server's version before opening the real one. See EA's Program.cs for the incident
// this pattern was copied from avoiding.
var serverVersion = ServerVersion.AutoDetect(connectionString);

builder.Services.AddDbContext<P2SDbContext>(options =>
    options.UseMySql(connectionString, serverVersion, mySqlOptions =>
        mySqlOptions.EnableRetryOnFailure(maxRetryCount: 4, maxRetryDelay: TimeSpan.FromSeconds(4), errorNumbersToAdd: null)));

builder.Services.Configure<JwtOptions>(builder.Configuration.GetSection(JwtOptions.SectionName));
builder.Services.AddScoped<ITokenService, JwtTokenService>();
builder.Services.AddScoped<IDailyFinanceSnapshotService, DailyFinanceSnapshotService>();
builder.Services.AddHostedService<DailyFinanceSnapshotBackgroundService>();
builder.Services.AddScoped<IInventoryService, InventoryService>();
builder.Services.AddScoped<ICancellationService, CancellationService>();
builder.Services.AddScoped<IReimbursementService, ReimbursementService>();

var jwtOptions = builder.Configuration.GetSection(JwtOptions.SectionName).Get<JwtOptions>()
    ?? throw new InvalidOperationException("Missing Jwt configuration section.");

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwtOptions.Issuer,
            ValidAudience = jwtOptions.Audience,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtOptions.SigningKey)),
            ClockSkew = TimeSpan.FromMinutes(1)
        };
    });

builder.Services.AddAuthorization();

var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [];
builder.Services.AddCors(options =>
{
    options.AddPolicy("Frontend", policy =>
        policy.WithOrigins(allowedOrigins).AllowAnyHeader().AllowAnyMethod());
});

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();

// Keep deployed databases aligned with the API before accepting requests.
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<P2SDbContext>();
    var pendingMigrations = await db.Database.GetPendingMigrationsAsync();
    var addsFinanceConstraints = pendingMigrations.Any(migration =>
        migration.EndsWith("_FinancialAuditAndReturnsAndUniquePlatformOrderNo", StringComparison.Ordinal) ||
        migration.EndsWith("_UniquePurchaseOrderReimbursementClaim", StringComparison.Ordinal));
    if (addsFinanceConstraints)
    {
        var appliedMigrations = await db.Database.GetAppliedMigrationsAsync();
        if (appliedMigrations.Contains("20260922070555_InitialCreate", StringComparer.Ordinal))
        {
            var duplicateOrderNumbers = await db.PurchaseOrders
                .GroupBy(order => new { order.PlatformId, OrderNo = order.PlatformOrderNo.Trim() })
                .Where(group => group.Count() > 1)
                .Select(group => new { group.Key.PlatformId, group.Key.OrderNo, Count = group.Count() })
                .ToListAsync();

            if (duplicateOrderNumbers.Count > 0)
            {
                var conflicts = string.Join("; ", duplicateOrderNumbers.Select(group =>
                    $"platformId={group.PlatformId}, orderNo='{group.OrderNo}' ({group.Count} records)"));
                throw new InvalidOperationException(
                    $"Cannot apply the unique platform order number migration until duplicate historical orders are reviewed and resolved: {conflicts}");
            }

            var duplicateClaims = await db.Reimbursements
                .SelectMany(reimbursement => reimbursement.PurchaseOrders.Select(order => order.Id))
                .GroupBy(orderId => orderId)
                .Where(group => group.Count() > 1)
                .Select(group => new { PurchaseOrderId = group.Key, Count = group.Count() })
                .ToListAsync();
            if (duplicateClaims.Count > 0)
            {
                var conflicts = string.Join("; ", duplicateClaims.Select(group =>
                    $"purchaseOrderId={group.PurchaseOrderId} ({group.Count} reimbursement records)"));
                throw new InvalidOperationException(
                    $"Cannot apply the one-claim-per-order migration until duplicate historical claims are reviewed: {conflicts}");
            }
        }
    }

    await db.Database.MigrateAsync();
}

// Must sit ahead of any middleware that cares about scheme/remote IP — needed when
// deployed behind a reverse proxy (nginx/IIS or most PaaS) that terminates TLS and
// forwards plain HTTP internally.
app.UseForwardedHeaders(new ForwardedHeadersOptions
{
    ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto,
});

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

// Serves the built Frontend (Vite dist output) from wwwroot for the single-host
// deploy — no-op in local dev, where wwwroot stays empty (dev uses the separate
// Vite dev server on :5173 instead, via CORS below).
app.UseDefaultFiles();
app.UseStaticFiles();

app.MapGet("/health", (IConfiguration config) =>
    Results.Ok(new { status = "ok", release = config["Release:Id"] ?? "unknown" }));

app.UseCors("Frontend");

app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

// SPA client-side routing fallback: without this, refreshing on a deep link like
// /inventory 404s once behind the single-host deploy (only /health and /api/* have
// real server routes — everything else must fall back to index.html and let the
// React router take over). Registered after MapControllers so API routes still win.
app.MapFallbackToFile("index.html");

app.Run();

public partial class Program { }
