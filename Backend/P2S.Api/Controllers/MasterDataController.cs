using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using P2S.Api.Data;
using P2S.Api.Data.Entities;
using P2S.Api.Dtos;

namespace P2S.Api.Controllers;

/// <summary>Products, Platforms, WithdrawalReasons and Users — screen 0.1 in PROJECT-PLAN.md.
/// Reads are open to any authenticated user (order/inventory screens need these lists too);
/// writes are admin-only.</summary>
[ApiController]
[Route("api")]
[Authorize]
public class MasterDataController : ControllerBase
{
    private readonly P2SDbContext _db;

    public MasterDataController(P2SDbContext db)
    {
        _db = db;
    }

    // ---- Products ----

    [HttpGet("products")]
    public async Task<ActionResult<List<ProductResponse>>> GetProducts(CancellationToken ct)
    {
        var products = await _db.Products
            .OrderBy(p => p.Name)
            .Select(p => new ProductResponse(p.Id, p.Name, p.SkuCode, p.Unit, p.IsActive))
            .ToListAsync(ct);
        return Ok(products);
    }

    [HttpPost("products")]
    [Authorize(Roles = "admin")]
    public async Task<ActionResult<ProductResponse>> CreateProduct(CreateProductRequest request, CancellationToken ct)
    {
        if (await _db.Products.AnyAsync(p => p.SkuCode == request.SkuCode, ct))
        {
            return Conflict(new { message = $"SKU '{request.SkuCode}' มีอยู่แล้ว" });
        }

        var product = new Product { Name = request.Name, SkuCode = request.SkuCode, Unit = request.Unit, IsActive = true };
        _db.Products.Add(product);
        await _db.SaveChangesAsync(ct);
        return Ok(new ProductResponse(product.Id, product.Name, product.SkuCode, product.Unit, product.IsActive));
    }

    [HttpPut("products/{id:int}")]
    [Authorize(Roles = "admin")]
    public async Task<ActionResult<ProductResponse>> UpdateProduct(int id, UpdateProductRequest request, CancellationToken ct)
    {
        var product = await _db.Products.FindAsync([id], ct);
        if (product is null) return NotFound();

        if (request.SkuCode != product.SkuCode && await _db.Products.AnyAsync(p => p.Id != id && p.SkuCode == request.SkuCode, ct))
        {
            return Conflict(new { message = $"SKU '{request.SkuCode}' มีอยู่แล้ว" });
        }

        product.Name = request.Name;
        product.SkuCode = request.SkuCode;
        product.Unit = request.Unit;
        product.IsActive = request.IsActive;
        await _db.SaveChangesAsync(ct);
        return Ok(new ProductResponse(product.Id, product.Name, product.SkuCode, product.Unit, product.IsActive));
    }

    [HttpDelete("products/{id:int}")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> DeleteProduct(int id, CancellationToken ct)
    {
        var product = await _db.Products.FindAsync([id], ct);
        if (product is null) return NotFound();

        bool hasUsage = await _db.OrderItems.AnyAsync(o => o.ProductId == id, ct)
                     || await _db.InventoryItems.AnyAsync(i => i.ProductId == id, ct);
        if (hasUsage)
            return Conflict(new { message = "ไม่สามารถลบสินค้านี้ได้ เนื่องจากมีข้อมูลอ้างอิงอยู่ (ลองปิดใช้งานแทน)" });

        _db.Products.Remove(product);
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    // ---- Platforms ----

    [HttpGet("platforms")]
    public async Task<ActionResult<List<PlatformResponse>>> GetPlatforms(CancellationToken ct)
    {
        var platforms = await _db.Platforms
            .OrderBy(p => p.Code)
            .Select(p => new PlatformResponse(p.Id, p.Code, p.Name, p.IsActive))
            .ToListAsync(ct);
        return Ok(platforms);
    }

    [HttpPost("platforms")]
    [Authorize(Roles = "admin")]
    public async Task<ActionResult<PlatformResponse>> CreatePlatform(CreatePlatformRequest request, CancellationToken ct)
    {
        if (await _db.Platforms.AnyAsync(p => p.Code == request.Code, ct))
        {
            return Conflict(new { message = $"Platform code '{request.Code}' มีอยู่แล้ว" });
        }

        var platform = new Platform { Code = request.Code, Name = request.Name, IsActive = true };
        _db.Platforms.Add(platform);
        await _db.SaveChangesAsync(ct);
        return Ok(new PlatformResponse(platform.Id, platform.Code, platform.Name, platform.IsActive));
    }

    [HttpPut("platforms/{id:int}")]
    [Authorize(Roles = "admin")]
    public async Task<ActionResult<PlatformResponse>> UpdatePlatform(int id, UpdatePlatformRequest request, CancellationToken ct)
    {
        var platform = await _db.Platforms.FindAsync([id], ct);
        if (platform is null) return NotFound();

        platform.Name = request.Name;
        platform.IsActive = request.IsActive;
        await _db.SaveChangesAsync(ct);
        return Ok(new PlatformResponse(platform.Id, platform.Code, platform.Name, platform.IsActive));
    }

    [HttpDelete("platforms/{id:int}")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> DeletePlatform(int id, CancellationToken ct)
    {
        var platform = await _db.Platforms.FindAsync([id], ct);
        if (platform is null) return NotFound();

        bool hasUsage = await _db.PurchaseOrders.AnyAsync(o => o.PlatformId == id, ct);
        if (hasUsage)
            return Conflict(new { message = "ไม่สามารถลบ platform นี้ได้ เนื่องจากมีออเดอร์อ้างอิงอยู่ (ลองปิดใช้งานแทน)" });

        _db.Platforms.Remove(platform);
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    // ---- Withdrawal reasons ----

    [HttpGet("withdrawal-reasons")]
    public async Task<ActionResult<List<WithdrawalReasonResponse>>> GetWithdrawalReasons(CancellationToken ct)
    {
        var reasons = await _db.WithdrawalReasons
            .OrderBy(r => r.Id)
            .Select(r => new WithdrawalReasonResponse(r.Id, r.Name, r.IsActive))
            .ToListAsync(ct);
        return Ok(reasons);
    }

    [HttpPost("withdrawal-reasons")]
    [Authorize(Roles = "admin")]
    public async Task<ActionResult<WithdrawalReasonResponse>> CreateWithdrawalReason(CreateWithdrawalReasonRequest request, CancellationToken ct)
    {
        var reason = new WithdrawalReason { Name = request.Name, IsActive = true };
        _db.WithdrawalReasons.Add(reason);
        await _db.SaveChangesAsync(ct);
        return Ok(new WithdrawalReasonResponse(reason.Id, reason.Name, reason.IsActive));
    }

    [HttpPut("withdrawal-reasons/{id:int}")]
    [Authorize(Roles = "admin")]
    public async Task<ActionResult<WithdrawalReasonResponse>> UpdateWithdrawalReason(int id, UpdateWithdrawalReasonRequest request, CancellationToken ct)
    {
        var reason = await _db.WithdrawalReasons.FindAsync([id], ct);
        if (reason is null) return NotFound();

        reason.Name = request.Name;
        reason.IsActive = request.IsActive;
        await _db.SaveChangesAsync(ct);
        return Ok(new WithdrawalReasonResponse(reason.Id, reason.Name, reason.IsActive));
    }

    [HttpDelete("withdrawal-reasons/{id:int}")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> DeleteWithdrawalReason(int id, CancellationToken ct)
    {
        var reason = await _db.WithdrawalReasons.FindAsync([id], ct);
        if (reason is null) return NotFound();

        bool hasUsage = await _db.InventoryWithdrawals.AnyAsync(w => w.WithdrawalReasonId == id, ct);
        if (hasUsage)
            return Conflict(new { message = "ไม่สามารถลบเหตุผลนี้ได้ เนื่องจากมีการเบิกของอ้างอิงอยู่ (ลองปิดใช้งานแทน)" });

        _db.WithdrawalReasons.Remove(reason);
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    // ---- Users ----

    [HttpGet("users")]
    [Authorize(Roles = "admin")]
    public async Task<ActionResult<List<UserResponse>>> GetUsers(CancellationToken ct)
    {
        var users = await _db.Users
            .Include(u => u.Role)
            .OrderBy(u => u.Username)
            .Select(u => new UserResponse(u.Id, u.Username, u.FullName, u.Role.Name, u.IsActive, u.CardLast4))
            .ToListAsync(ct);
        return Ok(users);
    }

    [HttpPost("users")]
    [Authorize(Roles = "admin")]
    public async Task<ActionResult<UserResponse>> CreateUser(CreateUserRequest request, CancellationToken ct)
    {
        if (await _db.Users.AnyAsync(u => u.Username == request.Username, ct))
        {
            return Conflict(new { message = $"Username '{request.Username}' มีอยู่แล้ว" });
        }

        var role = await _db.Roles.FirstOrDefaultAsync(r => r.Name == request.Role, ct);
        if (role is null) return BadRequest(new { message = $"ไม่รู้จัก role '{request.Role}'" });

        var user = new User
        {
            Username = request.Username,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
            FullName = request.FullName,
            RoleId = role.Id,
            Role = role,
            CardLast4 = request.CardLast4,
            IsActive = true,
        };
        _db.Users.Add(user);
        await _db.SaveChangesAsync(ct);
        return Ok(new UserResponse(user.Id, user.Username, user.FullName, role.Name, user.IsActive, user.CardLast4));
    }

    [HttpPut("users/{id:int}")]
    [Authorize(Roles = "admin")]
    public async Task<ActionResult<UserResponse>> UpdateUser(int id, UpdateUserRequest request, CancellationToken ct)
    {
        var user = await _db.Users.Include(u => u.Role).FirstOrDefaultAsync(u => u.Id == id, ct);
        if (user is null) return NotFound();

        user.FullName = request.FullName;
        user.IsActive = request.IsActive;
        user.CardLast4 = request.CardLast4;
        await _db.SaveChangesAsync(ct);
        return Ok(new UserResponse(user.Id, user.Username, user.FullName, user.Role.Name, user.IsActive, user.CardLast4));
    }

    [HttpDelete("users/{id:int}")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> DeleteUser(int id, CancellationToken ct)
    {
        var user = await _db.Users.FindAsync([id], ct);
        if (user is null) return NotFound();

        bool hasUsage = await _db.PurchaseOrders.AnyAsync(o => o.OrderedByUserId == id, ct)
                     || await _db.Deliveries.AnyAsync(d => d.ScannedByUserId == id, ct)
                     || await _db.Reimbursements.AnyAsync(r => r.RequestedByUserId == id, ct)
                     || await _db.InventoryWithdrawals.AnyAsync(w => w.WithdrawnByUserId == id, ct)
                     || await _db.StaffLedgerEntries.AnyAsync(e => e.UserId == id, ct);
        if (hasUsage)
            return Conflict(new { message = "ไม่สามารถลบผู้ใช้นี้ได้ เนื่องจากมีข้อมูลอ้างอิงอยู่ (ลองปิดใช้งานแทน)" });

        _db.Users.Remove(user);
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }
}
