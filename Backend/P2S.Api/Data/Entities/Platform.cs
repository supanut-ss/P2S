namespace P2S.Api.Data.Entities;

public class Platform
{
    public int Id { get; set; }

    /// <summary>Short code e.g. SP / TT / AM — used in UI filters and order numbers.</summary>
    public string Code { get; set; } = null!;
    public string Name { get; set; } = null!;
    public bool IsActive { get; set; } = true;
}
