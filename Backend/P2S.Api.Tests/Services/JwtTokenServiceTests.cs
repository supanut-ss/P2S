using System.IdentityModel.Tokens.Jwt;
using Microsoft.Extensions.Options;
using P2S.Api.Data.Entities;
using P2S.Api.Services;

namespace P2S.Api.Tests.Services;

public class JwtTokenServiceTests
{
    private static JwtTokenService CreateService() => new(Options.Create(new JwtOptions
    {
        Issuer = "P2S.Api.Tests",
        Audience = "P2S.Client.Tests",
        SigningKey = "unit-test-signing-key-at-least-32-chars-long",
        ExpiryMinutes = 60
    }));

    [Fact]
    public void IssueToken_EncodesUsernameAndRoleClaims()
    {
        var service = CreateService();
        var user = new User
        {
            Id = 42,
            Username = "somchai",
            FullName = "Somchai Jaidee",
            RoleId = 1,
            Role = new Role { Id = 1, Name = "staff" }
        };

        var (token, expiresAt) = service.IssueToken(user);

        var jwt = new JwtSecurityTokenHandler().ReadJwtToken(token);
        Assert.Equal("somchai", jwt.Claims.First(c => c.Type == "unique_name" || c.Type == System.Security.Claims.ClaimTypes.Name).Value);
        Assert.Contains(jwt.Claims, c => c.Value == "staff");
        Assert.True(expiresAt > DateTime.UtcNow);
    }
}
