namespace P2S.Api.Dtos;

public record LoginRequest(string Username, string Password);

public record LoginResponse(string Token, DateTime ExpiresAt, string Username, string FullName, string Role);

/// <summary>Admin-only: resets another user's password since there is no email to self-serve a reset with.</summary>
public record AdminResetPasswordRequest(int UserId, string NewPassword);
