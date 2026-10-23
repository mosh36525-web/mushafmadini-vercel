-- Recovery by code was removed; invalidate every previously issued code, including disclosed codes.
UPDATE `recovery_codes` SET `used` = true WHERE `used` = false;
