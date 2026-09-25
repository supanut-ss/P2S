using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace P2S.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class OrderItemPurchaseMetadata : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Description",
                table: "OrderItems",
                type: "varchar(1000)",
                maxLength: 1000,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "Model",
                table: "OrderItems",
                type: "varchar(200)",
                maxLength: 200,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "PackageName",
                table: "OrderItems",
                type: "varchar(200)",
                maxLength: 200,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "ShopName",
                table: "OrderItems",
                type: "varchar(200)",
                maxLength: 200,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Description",
                table: "OrderItems");

            migrationBuilder.DropColumn(
                name: "Model",
                table: "OrderItems");

            migrationBuilder.DropColumn(
                name: "PackageName",
                table: "OrderItems");

            migrationBuilder.DropColumn(
                name: "ShopName",
                table: "OrderItems");
        }
    }
}
