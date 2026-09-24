using System;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace P2S.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class PaymentAmountCorrections : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "PurchaseOrderPaymentCorrections",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("MySql:ValueGenerationStrategy", MySqlValueGenerationStrategy.IdentityColumn),
                    PurchaseOrderId = table.Column<int>(type: "int", nullable: false),
                    ReimbursementId = table.Column<int>(type: "int", nullable: false),
                    PreviousActualPaidAmount = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    CorrectedActualPaidAmount = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    PreviousRequestStatus = table.Column<int>(type: "int", nullable: false),
                    PreviousApprovedByUserId = table.Column<int>(type: "int", nullable: true),
                    PreviousApprovedAt = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    CorrectedByUserId = table.Column<int>(type: "int", nullable: false),
                    CorrectedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    Reason = table.Column<string>(type: "varchar(500)", maxLength: 500, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PurchaseOrderPaymentCorrections", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PurchaseOrderPaymentCorrections_PurchaseOrders_PurchaseOrder~",
                        column: x => x.PurchaseOrderId,
                        principalTable: "PurchaseOrders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_PurchaseOrderPaymentCorrections_Reimbursements_Reimbursement~",
                        column: x => x.ReimbursementId,
                        principalTable: "Reimbursements",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_PurchaseOrderPaymentCorrections_Users_CorrectedByUserId",
                        column: x => x.CorrectedByUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_PurchaseOrderPaymentCorrections_Users_PreviousApprovedByUser~",
                        column: x => x.PreviousApprovedByUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "IX_PurchaseOrderPaymentCorrections_CorrectedByUserId",
                table: "PurchaseOrderPaymentCorrections",
                column: "CorrectedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_PurchaseOrderPaymentCorrections_PreviousApprovedByUserId",
                table: "PurchaseOrderPaymentCorrections",
                column: "PreviousApprovedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_PurchaseOrderPaymentCorrections_PurchaseOrderId_CorrectedAt",
                table: "PurchaseOrderPaymentCorrections",
                columns: new[] { "PurchaseOrderId", "CorrectedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_PurchaseOrderPaymentCorrections_ReimbursementId_CorrectedAt",
                table: "PurchaseOrderPaymentCorrections",
                columns: new[] { "ReimbursementId", "CorrectedAt" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "PurchaseOrderPaymentCorrections");
        }
    }
}
