using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace P2S.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class OrderHeaderTracking : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Courier",
                table: "PurchaseOrders",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "TrackingNo",
                table: "PurchaseOrders",
                type: "varchar(255)",
                maxLength: 255,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.Sql("""
                UPDATE PurchaseOrders AS purchaseOrder
                JOIN (
                    SELECT PurchaseOrderId, MIN(TRIM(TrackingNo)) AS TrackingNo
                    FROM OrderItems
                    WHERE TrackingNo IS NOT NULL AND TRIM(TrackingNo) <> ''
                    GROUP BY PurchaseOrderId
                    HAVING COUNT(DISTINCT TRIM(TrackingNo)) = 1
                ) AS legacyTracking ON legacyTracking.PurchaseOrderId = purchaseOrder.Id
                SET purchaseOrder.TrackingNo = legacyTracking.TrackingNo
                WHERE purchaseOrder.TrackingNo IS NULL;
                """);

            migrationBuilder.Sql("""
                UPDATE PurchaseOrders AS purchaseOrder
                JOIN (
                    SELECT PurchaseOrderId, MIN(TRIM(Courier)) AS Courier
                    FROM OrderItems
                    WHERE Courier IS NOT NULL AND TRIM(Courier) <> ''
                    GROUP BY PurchaseOrderId
                    HAVING COUNT(DISTINCT TRIM(Courier)) = 1
                ) AS legacyCourier ON legacyCourier.PurchaseOrderId = purchaseOrder.Id
                SET purchaseOrder.Courier = legacyCourier.Courier
                WHERE purchaseOrder.Courier IS NULL;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Courier",
                table: "PurchaseOrders");

            migrationBuilder.DropColumn(
                name: "TrackingNo",
                table: "PurchaseOrders");
        }
    }
}
