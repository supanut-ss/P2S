using System;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace P2S.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class OrderNumberGoodsReceipt : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "ReceivedQty",
                table: "OrderItems",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.Sql("UPDATE `OrderItems` SET `ReceivedQty` = `Qty` WHERE `Status` IN (1, 3);");

            migrationBuilder.CreateTable(
                name: "GoodsReceiptEvents",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("MySql:ValueGenerationStrategy", MySqlValueGenerationStrategy.IdentityColumn),
                    PurchaseOrderId = table.Column<int>(type: "int", nullable: false),
                    EventType = table.Column<int>(type: "int", nullable: false),
                    EntryMethod = table.Column<int>(type: "int", nullable: false),
                    EnteredOrderNo = table.Column<string>(type: "varchar(100)", maxLength: 100, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    LineCount = table.Column<int>(type: "int", nullable: false),
                    UnitCount = table.Column<int>(type: "int", nullable: false),
                    ActorUserId = table.Column<int>(type: "int", nullable: false),
                    OccurredAt = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    ReversesEventId = table.Column<int>(type: "int", nullable: true),
                    Reason = table.Column<string>(type: "varchar(500)", maxLength: 500, nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_GoodsReceiptEvents", x => x.Id);
                    table.ForeignKey(
                        name: "FK_GoodsReceiptEvents_GoodsReceiptEvents_ReversesEventId",
                        column: x => x.ReversesEventId,
                        principalTable: "GoodsReceiptEvents",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_GoodsReceiptEvents_PurchaseOrders_PurchaseOrderId",
                        column: x => x.PurchaseOrderId,
                        principalTable: "PurchaseOrders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_GoodsReceiptEvents_Users_ActorUserId",
                        column: x => x.ActorUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "GoodsReceiptEventLines",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("MySql:ValueGenerationStrategy", MySqlValueGenerationStrategy.IdentityColumn),
                    GoodsReceiptEventId = table.Column<int>(type: "int", nullable: false),
                    OrderItemId = table.Column<int>(type: "int", nullable: false),
                    Quantity = table.Column<int>(type: "int", nullable: false),
                    UnitPrice = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_GoodsReceiptEventLines", x => x.Id);
                    table.ForeignKey(
                        name: "FK_GoodsReceiptEventLines_GoodsReceiptEvents_GoodsReceiptEventId",
                        column: x => x.GoodsReceiptEventId,
                        principalTable: "GoodsReceiptEvents",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_GoodsReceiptEventLines_OrderItems_OrderItemId",
                        column: x => x.OrderItemId,
                        principalTable: "OrderItems",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "IX_GoodsReceiptEventLines_GoodsReceiptEventId_OrderItemId",
                table: "GoodsReceiptEventLines",
                columns: new[] { "GoodsReceiptEventId", "OrderItemId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_GoodsReceiptEventLines_OrderItemId",
                table: "GoodsReceiptEventLines",
                column: "OrderItemId");

            migrationBuilder.CreateIndex(
                name: "IX_GoodsReceiptEvents_ActorUserId",
                table: "GoodsReceiptEvents",
                column: "ActorUserId");

            migrationBuilder.CreateIndex(
                name: "IX_GoodsReceiptEvents_PurchaseOrderId_OccurredAt",
                table: "GoodsReceiptEvents",
                columns: new[] { "PurchaseOrderId", "OccurredAt" });

            migrationBuilder.CreateIndex(
                name: "IX_GoodsReceiptEvents_ReversesEventId",
                table: "GoodsReceiptEvents",
                column: "ReversesEventId",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "GoodsReceiptEventLines");

            migrationBuilder.DropTable(
                name: "GoodsReceiptEvents");

            migrationBuilder.DropColumn(
                name: "ReceivedQty",
                table: "OrderItems");
        }
    }
}
