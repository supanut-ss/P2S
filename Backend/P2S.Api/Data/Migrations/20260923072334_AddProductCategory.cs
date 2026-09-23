using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace P2S.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddProductCategory : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
migrationBuilder.AddColumn<string>(
name: "Category",
table: "Products",
type: "varchar(100)",
maxLength: 100,
nullable: false,
defaultValue: "ทั่วไป")
.Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.Sql("""
                INSERT IGNORE INTO `Products` (`Name`, `SkuCode`, `Category`, `Unit`, `IsActive`)
                VALUES
                    ('มือถือ 01', 'MOB-001', 'มือถือ', 'เครื่อง', 1),
                    ('มือถือ 02', 'MOB-002', 'มือถือ', 'เครื่อง', 1),
                    ('มือถือ 03', 'MOB-003', 'มือถือ', 'เครื่อง', 1),
                    ('มือถือ 04', 'MOB-004', 'มือถือ', 'เครื่อง', 1),
                    ('มือถือ 05', 'MOB-005', 'มือถือ', 'เครื่อง', 1),
                    ('มือถือ 06', 'MOB-006', 'มือถือ', 'เครื่อง', 1),
                    ('มือถือ 07', 'MOB-007', 'มือถือ', 'เครื่อง', 1),
                    ('มือถือ 08', 'MOB-008', 'มือถือ', 'เครื่อง', 1),
                    ('มือถือ 09', 'MOB-009', 'มือถือ', 'เครื่อง', 1),
                    ('มือถือ 10', 'MOB-010', 'มือถือ', 'เครื่อง', 1);
                """);

}

        /// <inheritdoc />
protected override void Down(MigrationBuilder migrationBuilder)
{
            migrationBuilder.Sql("""
                DELETE FROM `Products`
                WHERE `Category` = 'มือถือ'
                  AND `Unit` = 'เครื่อง'
                  AND `IsActive` = 1
                  AND NOT EXISTS (
                    SELECT 1 FROM `OrderItems`
                    WHERE `OrderItems`.`ProductId` = `Products`.`Id`
                  )
                  AND NOT EXISTS (
                    SELECT 1 FROM `InventoryItems`
                    WHERE `InventoryItems`.`ProductId` = `Products`.`Id`
                  )
                  AND (
                    (`SkuCode` = 'MOB-001' AND `Name` = 'มือถือ 01') OR
                    (`SkuCode` = 'MOB-002' AND `Name` = 'มือถือ 02') OR
                    (`SkuCode` = 'MOB-003' AND `Name` = 'มือถือ 03') OR
                    (`SkuCode` = 'MOB-004' AND `Name` = 'มือถือ 04') OR
                    (`SkuCode` = 'MOB-005' AND `Name` = 'มือถือ 05') OR
                    (`SkuCode` = 'MOB-006' AND `Name` = 'มือถือ 06') OR
                    (`SkuCode` = 'MOB-007' AND `Name` = 'มือถือ 07') OR
                    (`SkuCode` = 'MOB-008' AND `Name` = 'มือถือ 08') OR
                    (`SkuCode` = 'MOB-009' AND `Name` = 'มือถือ 09') OR
                    (`SkuCode` = 'MOB-010' AND `Name` = 'มือถือ 10')
                  );
                """);

migrationBuilder.DropColumn(
name: "Category",
table: "Products");

        }
    }
}
