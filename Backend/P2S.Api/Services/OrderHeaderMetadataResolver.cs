namespace P2S.Api.Services;

internal static class OrderHeaderMetadataResolver
{
    public static string? Resolve(string? headerValue, IEnumerable<string?> legacyItemValues)
    {
        if (!string.IsNullOrWhiteSpace(headerValue)) return headerValue.Trim();

        var values = legacyItemValues
            .Select(value => value?.Trim())
            .OfType<string>()
            .Where(value => value.Length > 0)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        return values.Count switch
        {
            0 => null,
            1 => values[0],
            _ => string.Join(" / ", values),
        };
    }
}
