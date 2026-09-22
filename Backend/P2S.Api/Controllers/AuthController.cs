using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using P2S.Api.Data;
using P2S.Api.Dtos;
using P2S.Api.Services;

namespace P2S.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly P2SDbContext _db;
    private readonly ITokenService _tokenService;

    public AuthController(P2SDbContext db, ITokenService tokenService)
    {
        _db = db;
        _tokenService = tokenService;
    }

    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<ActionResult<LoginResponse>> Login(LoginRequest request)
    {
        var user = await _db.Users
            .Include(u => u.Role)
            .FirstOrDefaultAsync(u => u.Username == request.Username);

        if (user is null || !user.IsActive || !BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
        {
            return Unauthorized(new { message = "Username หรือ Password ไม่ถูกต้อง" });
        }

        var (token, expiresAt) = _tokenService.IssueToken(user);
        return Ok(new LoginResponse(token, expiresAt, user.Username, user.FullName, user.Role.Name));
    }

    /// <summary>No email = no self-serve reset. An admin resets another user's password directly instead.</summary>
    [HttpPost("admin-reset-password")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> AdminResetPassword(AdminResetPasswordRequest request)
    {
        var user = await _db.Users.FindAsync(request.UserId);
        if (user is null) return NotFound();

        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword);
        await _db.SaveChangesAsync();
        return NoContent();
    }
}
