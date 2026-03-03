import { Test, TestingModule } from '@nestjs/testing';
import { OmrService } from './omr.service';

describe('OmrService', () => {
  let service: OmrService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [OmrService],
    }).compile();

    service = module.get<OmrService>(OmrService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
