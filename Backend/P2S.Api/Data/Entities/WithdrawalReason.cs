namespace P2S.Api.Data.Entities;

public class WithdrawalReason
{
    public int Id { get; set; }
    public string Name { get; set; } = null!;
    public bool IsActive { get; set; } = true;
}
