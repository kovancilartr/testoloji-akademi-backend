import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';

@Injectable()
export class TenantContext {
    private static readonly storage = new AsyncLocalStorage<{ organizationId: string }>();

    static run<T>(organizationId: string, fn: () => T): T {
        return this.storage.run({ organizationId }, fn);
    }

    static getOrganizationId(): string | undefined {
        return this.storage.getStore()?.organizationId;
    }
}
