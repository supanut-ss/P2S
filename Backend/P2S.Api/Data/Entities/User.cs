namespace P2S.Api.Data.Entities;

public class User
{
    public int Id { get; set; }
    public string Username { get; set; } = null!;
    public string PasswordHash { get; set; } = null!;
    public string FullName { get; set; } = null!;
    public int RoleId { get; set; }
    public Role Role { get; set; } = null!;
    public bool IsActive { get; set; } = true;

    /// <summary>Last 4 digits of the staff member's own card used to place orders — display only, never full PAN.</summary>
    public string? CardLast4 { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
