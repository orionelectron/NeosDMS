jest.mock('./provisioning.logic', () => ({
  provisionAccounting: jest.fn().mockResolvedValue(undefined),
}));

import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { provisionAccounting } from './provisioning.logic';
import { AccountingProvisioningService } from './provisioning.service';

describe('AccountingProvisioningService', () => {
  let service: AccountingProvisioningService;
  let dataSource: { transaction: jest.Mock };

  beforeEach(async () => {
    dataSource = {
      transaction: jest.fn((fn: (m: unknown) => unknown) => fn({})),
    };
    (provisionAccounting as jest.Mock).mockClear();

    const moduleRef = await Test.createTestingModule({
      providers: [
        AccountingProvisioningService,
        { provide: getDataSourceToken(), useValue: dataSource },
      ],
    }).compile();

    service = moduleRef.get(AccountingProvisioningService);
  });

  it('wraps provisioning in a transaction when no manager is passed', async () => {
    await service.provision('org-1');

    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(provisionAccounting).toHaveBeenCalledWith(
      expect.anything(),
      'org-1',
    );
  });

  it('uses the provided manager directly without a transaction', async () => {
    const manager = { query: jest.fn() } as never;

    await service.provision('org-1', manager);

    expect(dataSource.transaction).not.toHaveBeenCalled();
    expect(provisionAccounting).toHaveBeenCalledWith(manager, 'org-1');
  });
});
