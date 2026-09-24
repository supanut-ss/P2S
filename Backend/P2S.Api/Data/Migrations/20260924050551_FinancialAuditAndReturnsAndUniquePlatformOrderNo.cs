using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace P2S.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class FinancialAuditAndReturnsAndUniquePlatformOrderNo : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_PurchaseOrders_Platforms_PlatformId",
                table: "PurchaseOrders");

            migrationBuilder.DropIndex(
                name: "IX_PurchaseOrders_PlatformId_PlatformOrderNo",
                table: "PurchaseOrders");

            migrationBuilder.DropIndex(
                name: "IX_Cancellations_OrderItemId",
                table: "Cancellations");

            migrationBuilder.AddColumn<int>(
                name: "ApprovedByUserId",
                table: "Reimbursements",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "PaidByUserId",
                table: "Reimbursements",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<uint>(
                name: "RowVersion",
                table: "Reimbursements",
                type: "int unsigned",
                nullable: false,
                defaultValue: 0u);

            migrationBuilder.AddColumn<decimal>(
                name: "ActualPaidAmount",
                table: "PurchaseOrders",
                type: "decimal(18,2)",
                precision: 18,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "PaidAt",
                table: "PurchaseOrders",
                type: "datetime(6)",
                nullable: true);

            migrationBuilder.AddColumn<byte[]>(
                name: "PaymentEvidence",
                table: "PurchaseOrders",
                type: "longblob",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PaymentEvidenceContentType",
                table: "PurchaseOrders",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "PaymentEvidenceFileName",
                table: "PurchaseOrders",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<int>(
                name: "PaymentPayerUserId",
                table: "PurchaseOrders",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "PaymentRecordedByUserId",
                table: "PurchaseOrders",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "PaymentSource",
                table: "PurchaseOrders",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<uint>(
                name: "RowVersion",
                table: "PurchaseOrders",
                type: "int unsigned",
                nullable: false,
                defaultValue: 0u);

            migrationBuilder.AddColumn<int>(
                name: "ReturnedQty",
                table: "OrderItems",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<uint>(
                name: "RowVersion",
                table: "OrderItems",
                type: "int unsigned",
                nullable: false,
                defaultValue: 0u);

            migrationBuilder.AddColumn<int>(
                name: "Quantity",
                table: "Cancellations",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<decimal>(
                name: "RefundAmount",
                table: "Cancellations",
                type: "decimal(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<int>(
                name: "ReportedByUserId",
                table: "Cancellations",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ResolvedByUserId",
                table: "Cancellations",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<uint>(
                name: "RowVersion",
                table: "Cancellations",
                type: "int unsigned",
                nullable: false,
                defaultValue: 0u);

            migrationBuilder.Sql("""
                UPDATE `PurchaseOrders`
                SET `PlatformOrderNo` = TRIM(`PlatformOrderNo`);
                """);

            migrationBuilder.Sql("""
                UPDATE `PurchaseOrders`
                SET `ActualPaidAmount` = `TotalAmount`,
                    `PaymentSource` = 0,
                    `PaymentPayerUserId` = `OrderedByUserId`
                WHERE `Status` IN (1, 2);
                """);

            migrationBuilder.Sql("""
                UPDATE `Cancellations` AS cancellation
                INNER JOIN `OrderItems` AS orderItem ON orderItem.`Id` = cancellation.`OrderItemId`
                SET cancellation.`Quantity` = orderItem.`Qty`,
                    cancellation.`RefundAmount` = orderItem.`Qty` * orderItem.`UnitPrice`;
                """);

            migrationBuilder.CreateIndex(
                name: "IX_Reimbursements_ApprovedByUserId",
                table: "Reimbursements",
                column: "ApprovedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_Reimbursements_PaidByUserId",
                table: "Reimbursements",
                column: "PaidByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_PurchaseOrders_PaymentPayerUserId",
                table: "PurchaseOrders",
                column: "PaymentPayerUserId");

            migrationBuilder.CreateIndex(
                name: "IX_PurchaseOrders_PaymentRecordedByUserId",
                table: "PurchaseOrders",
                column: "PaymentRecordedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_PurchaseOrders_PlatformId_PlatformOrderNo",
                table: "PurchaseOrders",
                columns: new[] { "PlatformId", "PlatformOrderNo" },
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_PurchaseOrders_Platforms_PlatformId",
                table: "PurchaseOrders",
                column: "PlatformId",
                principalTable: "Platforms",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.CreateIndex(
                name: "IX_Cancellations_OrderItemId",
                table: "Cancellations",
                column: "OrderItemId");

            migrationBuilder.CreateIndex(
                name: "IX_Cancellations_ReportedByUserId",
                table: "Cancellations",
                column: "ReportedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_Cancellations_ResolvedByUserId",
                table: "Cancellations",
                column: "ResolvedByUserId");

            migrationBuilder.AddForeignKey(
                name: "FK_Cancellations_Users_ReportedByUserId",
                table: "Cancellations",
                column: "ReportedByUserId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Cancellations_Users_ResolvedByUserId",
                table: "Cancellations",
                column: "ResolvedByUserId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_PurchaseOrders_Users_PaymentPayerUserId",
                table: "PurchaseOrders",
                column: "PaymentPayerUserId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_PurchaseOrders_Users_PaymentRecordedByUserId",
                table: "PurchaseOrders",
                column: "PaymentRecordedByUserId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Reimbursements_Users_ApprovedByUserId",
                table: "Reimbursements",
                column: "ApprovedByUserId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Reimbursements_Users_PaidByUserId",
                table: "Reimbursements",
                column: "PaidByUserId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Cancellations_Users_ReportedByUserId",
                table: "Cancellations");

            migrationBuilder.DropForeignKey(
                name: "FK_Cancellations_Users_ResolvedByUserId",
                table: "Cancellations");

            migrationBuilder.DropForeignKey(
                name: "FK_PurchaseOrders_Users_PaymentPayerUserId",
                table: "PurchaseOrders");

            migrationBuilder.DropForeignKey(
                name: "FK_PurchaseOrders_Users_PaymentRecordedByUserId",
                table: "PurchaseOrders");

            migrationBuilder.DropForeignKey(
                name: "FK_Reimbursements_Users_ApprovedByUserId",
                table: "Reimbursements");

            migrationBuilder.DropForeignKey(
                name: "FK_Reimbursements_Users_PaidByUserId",
                table: "Reimbursements");

            migrationBuilder.DropIndex(
                name: "IX_Reimbursements_ApprovedByUserId",
                table: "Reimbursements");

            migrationBuilder.DropIndex(
                name: "IX_Reimbursements_PaidByUserId",
                table: "Reimbursements");

            migrationBuilder.DropIndex(
                name: "IX_PurchaseOrders_PaymentPayerUserId",
                table: "PurchaseOrders");

            migrationBuilder.DropIndex(
                name: "IX_PurchaseOrders_PaymentRecordedByUserId",
                table: "PurchaseOrders");

            migrationBuilder.DropForeignKey(
                name: "FK_PurchaseOrders_Platforms_PlatformId",
                table: "PurchaseOrders");

            migrationBuilder.DropIndex(
                name: "IX_PurchaseOrders_PlatformId_PlatformOrderNo",
                table: "PurchaseOrders");

            migrationBuilder.DropIndex(
                name: "IX_Cancellations_OrderItemId",
                table: "Cancellations");

            migrationBuilder.DropIndex(
                name: "IX_Cancellations_ReportedByUserId",
                table: "Cancellations");

            migrationBuilder.DropIndex(
                name: "IX_Cancellations_ResolvedByUserId",
                table: "Cancellations");

            migrationBuilder.DropColumn(
                name: "ApprovedByUserId",
                table: "Reimbursements");

            migrationBuilder.DropColumn(
                name: "PaidByUserId",
                table: "Reimbursements");

            migrationBuilder.DropColumn(
                name: "RowVersion",
                table: "Reimbursements");

            migrationBuilder.DropColumn(
                name: "ActualPaidAmount",
                table: "PurchaseOrders");

            migrationBuilder.DropColumn(
                name: "PaidAt",
                table: "PurchaseOrders");

            migrationBuilder.DropColumn(
                name: "PaymentEvidence",
                table: "PurchaseOrders");

            migrationBuilder.DropColumn(
                name: "PaymentEvidenceContentType",
                table: "PurchaseOrders");

            migrationBuilder.DropColumn(
                name: "PaymentEvidenceFileName",
                table: "PurchaseOrders");

            migrationBuilder.DropColumn(
                name: "PaymentPayerUserId",
                table: "PurchaseOrders");

            migrationBuilder.DropColumn(
                name: "PaymentRecordedByUserId",
                table: "PurchaseOrders");

            migrationBuilder.DropColumn(
                name: "PaymentSource",
                table: "PurchaseOrders");

            migrationBuilder.DropColumn(
                name: "RowVersion",
                table: "PurchaseOrders");

            migrationBuilder.DropColumn(
                name: "ReturnedQty",
                table: "OrderItems");

            migrationBuilder.DropColumn(
                name: "RowVersion",
                table: "OrderItems");

            migrationBuilder.DropColumn(
                name: "Quantity",
                table: "Cancellations");

            migrationBuilder.DropColumn(
                name: "RefundAmount",
                table: "Cancellations");

            migrationBuilder.DropColumn(
                name: "ReportedByUserId",
                table: "Cancellations");

            migrationBuilder.DropColumn(
                name: "ResolvedByUserId",
                table: "Cancellations");

            migrationBuilder.DropColumn(
                name: "RowVersion",
                table: "Cancellations");

            migrationBuilder.CreateIndex(
                name: "IX_PurchaseOrders_PlatformId_PlatformOrderNo",
                table: "PurchaseOrders",
                columns: new[] { "PlatformId", "PlatformOrderNo" });

            migrationBuilder.AddForeignKey(
                name: "FK_PurchaseOrders_Platforms_PlatformId",
                table: "PurchaseOrders",
                column: "PlatformId",
                principalTable: "Platforms",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.CreateIndex(
                name: "IX_Cancellations_OrderItemId",
                table: "Cancellations",
                column: "OrderItemId",
                unique: true);
        }
    }
}
