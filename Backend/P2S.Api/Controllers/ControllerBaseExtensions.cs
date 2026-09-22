using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;

namespace P2S.Api.Controllers;

public static class ControllerBaseExtensions
{
    /// <summary>
    /// The JWT "sub" claim carries the user id (see JwtTokenService.IssueToken), but ASP.NET
    /// Core's default inbound claim mapping rewrites "sub" to ClaimTypes.NameIdentifier before
    /// controllers see it — check both so this doesn't silently break if that mapping is ever
    /// disabled.
    /// </summary>
    public static int CurrentUserId(this ControllerBase controller)
    {
        var raw = controller.User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? controller.User.FindFirstValue(JwtRegisteredClaimNames.Sub);
        return int.Parse(raw ?? throw new InvalidOperationException("No user id claim on the authenticated principal."));
    }
}
