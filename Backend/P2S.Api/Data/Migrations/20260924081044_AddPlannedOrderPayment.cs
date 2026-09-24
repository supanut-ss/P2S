using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace P2S.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddPlannedOrderPayment : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "PlannedPaymentPayerUserId",
                table: "PurchaseOrders",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "PlannedPaymentSource",
                table: "PurchaseOrders",
                type: "int",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_PurchaseOrders_PlannedPaymentPayerUserId",
                table: "PurchaseOrders",
                column: "PlannedPaymentPayerUserId");

            migrationBuilder.AddForeignKey(
                name: "FK_PurchaseOrders_Users_PlannedPaymentPayerUserId",
                table: "PurchaseOrders",
                column: "PlannedPaymentPayerUserId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_PurchaseOrders_Users_PlannedPaymentPayerUserId",
                table: "PurchaseOrders");

            migrationBuilder.DropIndex(
                name: "IX_PurchaseOrders_PlannedPaymentPayerUserId",
                table: "PurchaseOrders");

            migrationBuilder.DropColumn(
                name: "PlannedPaymentPayerUserId",
                table: "PurchaseOrders");

            migrationBuilder.DropColumn(
                name: "PlannedPaymentSource",
                table: "PurchaseOrders");
        }
    }
}
