import { Test, TestingModule } from '@nestjs/testing';
import { OmrController } from './omr.controller';

describe('OmrController', () => {
  let controller: OmrController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OmrController],
    }).compile();

    controller = module.get<OmrController>(OmrController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
