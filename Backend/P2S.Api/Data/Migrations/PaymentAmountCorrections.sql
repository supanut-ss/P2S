START TRANSACTION;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260924063015_PaymentAmountCorrections') THEN

    CREATE TABLE `PurchaseOrderPaymentCorrections` (
        `Id` int NOT NULL AUTO_INCREMENT,
        `PurchaseOrderId` int NOT NULL,
        `ReimbursementId` int NOT NULL,
        `PreviousActualPaidAmount` decimal(18,2) NOT NULL,
        `CorrectedActualPaidAmount` decimal(18,2) NOT NULL,
        `PreviousRequestStatus` int NOT NULL,
        `PreviousApprovedByUserId` int NULL,
        `PreviousApprovedAt` datetime(6) NULL,
        `CorrectedByUserId` int NOT NULL,
        `CorrectedAt` datetime(6) NOT NULL,
        `Reason` varchar(500) CHARACTER SET utf8mb4 NOT NULL,
        CONSTRAINT `PK_PurchaseOrderPaymentCorrections` PRIMARY KEY (`Id`),
        CONSTRAINT `FK_PurchaseOrderPaymentCorrections_PurchaseOrders_PurchaseOrder~` FOREIGN KEY (`PurchaseOrderId`) REFERENCES `PurchaseOrders` (`Id`) ON DELETE RESTRICT,
        CONSTRAINT `FK_PurchaseOrderPaymentCorrections_Reimbursements_Reimbursement~` FOREIGN KEY (`ReimbursementId`) REFERENCES `Reimbursements` (`Id`) ON DELETE RESTRICT,
        CONSTRAINT `FK_PurchaseOrderPaymentCorrections_Users_CorrectedByUserId` FOREIGN KEY (`CorrectedByUserId`) REFERENCES `Users` (`Id`) ON DELETE RESTRICT,
        CONSTRAINT `FK_PurchaseOrderPaymentCorrections_Users_PreviousApprovedByUser~` FOREIGN KEY (`PreviousApprovedByUserId`) REFERENCES `Users` (`Id`) ON DELETE RESTRICT
    ) CHARACTER SET=utf8mb4;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260924063015_PaymentAmountCorrections') THEN

    CREATE INDEX `IX_PurchaseOrderPaymentCorrections_CorrectedByUserId` ON `PurchaseOrderPaymentCorrections` (`CorrectedByUserId`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260924063015_PaymentAmountCorrections') THEN

    CREATE INDEX `IX_PurchaseOrderPaymentCorrections_PreviousApprovedByUserId` ON `PurchaseOrderPaymentCorrections` (`PreviousApprovedByUserId`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260924063015_PaymentAmountCorrections') THEN

    CREATE INDEX `IX_PurchaseOrderPaymentCorrections_PurchaseOrderId_CorrectedAt` ON `PurchaseOrderPaymentCorrections` (`PurchaseOrderId`, `CorrectedAt`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260924063015_PaymentAmountCorrections') THEN

    CREATE INDEX `IX_PurchaseOrderPaymentCorrections_ReimbursementId_CorrectedAt` ON `PurchaseOrderPaymentCorrections` (`ReimbursementId`, `CorrectedAt`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260924063015_PaymentAmountCorrections') THEN

    INSERT INTO `__EFMigrationsHistory` (`MigrationId`, `ProductVersion`)
    VALUES ('20260924063015_PaymentAmountCorrections', '8.0.2');

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

COMMIT;

