namespace P2S.Api.Services;

/// <summary>
/// Thailand has observed a fixed UTC+7 offset with no DST since 1920, so a plain fixed
/// offset is used instead of TimeZoneInfo.FindSystemTimeZoneById — that call needs a
/// different id on Windows ("SE Asia Standard Time") vs Linux ("Asia/Bangkok"), which
/// is exactly the kind of environment-dependent failure worth avoiding for a value this
/// stable.
/// </summary>
public static class BangkokClock
{
    public static readonly TimeSpan Offset = TimeSpan.FromHours(7);

    public static DateTime UtcNowToBangkok() => DateTime.UtcNow + Offset;

    public static DateOnly TodayBusinessDate() => DateOnly.FromDateTime(UtcNowToBangkok());

    public static DateOnly ToBusinessDate(DateTime utc) => DateOnly.FromDateTime(utc + Offset);
}
