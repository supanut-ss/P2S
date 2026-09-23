using System.ComponentModel.DataAnnotations;

namespace P2S.Api.Dtos;

public record ProductResponse(int Id, string Name, string SkuCode, string Category, string Unit, bool IsActive);
public record CreateProductRequest(string Name, string SkuCode, string Unit, [property: MaxLength(100)] string Category = "ทั่วไป");
public record UpdateProductRequest(string Name, string SkuCode, string Unit, bool IsActive, [property: MaxLength(100)] string Category = "ทั่วไป");

public record PlatformResponse(int Id, string Code, string Name, bool IsActive);
public record CreatePlatformRequest(string Code, string Name);
public record UpdatePlatformRequest(string Name, bool IsActive);

public record WithdrawalReasonResponse(int Id, string Name, bool IsActive);
public record CreateWithdrawalReasonRequest(string Name);
public record UpdateWithdrawalReasonRequest(string Name, bool IsActive);

public record UserResponse(int Id, string Username, string FullName, string Role, bool IsActive, string? CardLast4);
public record CreateUserRequest(string Username, string Password, string FullName, string Role, string? CardLast4);
public record UpdateUserRequest(string FullName, bool IsActive, string? CardLast4);
