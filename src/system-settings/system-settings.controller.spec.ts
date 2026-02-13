import { Test, TestingModule } from '@nestjs/testing';
import { SystemSettingsController } from './system-settings.controller';

describe('SystemSettingsController', () => {
  let controller: SystemSettingsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SystemSettingsController],
    }).compile();

    controller = module.get<SystemSettingsController>(SystemSettingsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
