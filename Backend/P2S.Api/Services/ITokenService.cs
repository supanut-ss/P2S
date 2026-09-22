using P2S.Api.Data.Entities;

namespace P2S.Api.Services;

public interface ITokenService
{
    (string Token, DateTime ExpiresAt) IssueToken(User user);
}
