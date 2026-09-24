using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace P2S.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class UniquePurchaseOrderReimbursementClaim : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateIndex(
                name: "IX_PurchaseOrderReimbursement_PurchaseOrdersId",
                table: "PurchaseOrderReimbursement",
                column: "PurchaseOrdersId",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_PurchaseOrderReimbursement_PurchaseOrdersId",
                table: "PurchaseOrderReimbursement");
        }
    }
}
