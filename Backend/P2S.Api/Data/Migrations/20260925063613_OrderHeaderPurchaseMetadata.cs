using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace P2S.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class OrderHeaderPurchaseMetadata : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "PackageName",
                table: "PurchaseOrders",
                type: "varchar(200)",
                maxLength: 200,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "ShopName",
                table: "PurchaseOrders",
                type: "varchar(200)",
                maxLength: 200,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            // Backfill only values shared by every item. Conflicting legacy values remain on the items.
            migrationBuilder.Sql("""
                UPDATE PurchaseOrders AS purchaseOrder
                JOIN (
                    SELECT PurchaseOrderId, MIN(TRIM(PackageName)) AS PackageName
                    FROM OrderItems
                    WHERE PackageName IS NOT NULL AND TRIM(PackageName) <> ''
                    GROUP BY PurchaseOrderId
                    HAVING COUNT(DISTINCT TRIM(PackageName)) = 1
                ) AS itemMetadata ON itemMetadata.PurchaseOrderId = purchaseOrder.Id
                SET purchaseOrder.PackageName = itemMetadata.PackageName;
                """);

            migrationBuilder.Sql("""
                UPDATE PurchaseOrders AS purchaseOrder
                JOIN (
                    SELECT PurchaseOrderId, MIN(TRIM(ShopName)) AS ShopName
                    FROM OrderItems
                    WHERE ShopName IS NOT NULL AND TRIM(ShopName) <> ''
                    GROUP BY PurchaseOrderId
                    HAVING COUNT(DISTINCT TRIM(ShopName)) = 1
                ) AS itemMetadata ON itemMetadata.PurchaseOrderId = purchaseOrder.Id
                SET purchaseOrder.ShopName = itemMetadata.ShopName;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                UPDATE OrderItems AS orderItem
                JOIN PurchaseOrders AS purchaseOrder ON purchaseOrder.Id = orderItem.PurchaseOrderId
                SET orderItem.PackageName = purchaseOrder.PackageName
                WHERE purchaseOrder.PackageName IS NOT NULL;
                """);

            migrationBuilder.Sql("""
                UPDATE OrderItems AS orderItem
                JOIN PurchaseOrders AS purchaseOrder ON purchaseOrder.Id = orderItem.PurchaseOrderId
                SET orderItem.ShopName = purchaseOrder.ShopName
                WHERE purchaseOrder.ShopName IS NOT NULL;
                """);

            migrationBuilder.DropColumn(
                name: "PackageName",
                table: "PurchaseOrders");

            migrationBuilder.DropColumn(
                name: "ShopName",
                table: "PurchaseOrders");
        }
    }
}
