ALTER TABLE projects ADD COLUMN rwa_vault_address TEXT;

UPDATE projects
SET contract_address = '0x00344E2e44AFf7cF7429738E99Fd056a099A077F',
    rwa_registry_address = '0xaeCA0FEe07Debea353eB0728EdD1e9D917a94297',
    checkpoint_registry_address = '0x9fB26d32750f387c75F9577135a6E274730759D2',
    incident_machine_address = '0xBb9dfb771248594A365cabe0114cf362d68279a7',
    rwa_vault_address = '0x00344E2e44AFf7cF7429738E99Fd056a099A077F',
    adapter_address = '0x3d901880b9416ad7b00569C7b0B67b8e8008d6Af',
    updated_at = CURRENT_TIMESTAMP
WHERE pool_id = 'DUEVIA-RCV-018';
