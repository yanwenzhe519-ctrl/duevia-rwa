UPDATE projects
SET contract_address = '0x437Fcbb7b474036FB534e0AFFafdB600D970d798',
    rwa_vault_address = '0x437Fcbb7b474036FB534e0AFFafdB600D970d798',
    adapter_address = '0xeA1dbe4F4F8640214C1538210B494F5850537599',
    updated_at = CURRENT_TIMESTAMP
WHERE pool_id = 'DUEVIA-RCV-018';
