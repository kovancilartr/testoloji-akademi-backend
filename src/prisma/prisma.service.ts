import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { TenantContext } from '../common/tenant-context.service';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  constructor() {
    super();
    // Use a self-referential property to store the extended client
    return (this as any).$extends({
      query: {
        $allModels: {
          async $allOperations({ model, operation, args, query }: any) {
            const organizationId = TenantContext.getOrganizationId();

            const modelsWithTenant = ['User', 'Project', 'Course', 'Student', 'Classroom'];
            const operationsToFilter = ['findMany', 'findFirst', 'findFirstOrThrow', 'findUnique', 'findUniqueOrThrow', 'count', 'updateMany', 'deleteMany', 'update', 'delete'];

            if (organizationId && modelsWithTenant.includes(model) && operationsToFilter.includes(operation)) {
              // Ensure args and where exist
              args = args || {};
              args.where = args.where || {};

              // Apply organizationId filtering for non-unique operations
              if (!['findUnique', 'findUniqueOrThrow', 'update', 'delete'].includes(operation)) {
                args.where['organizationId'] = organizationId;
              }
            }

            // Create operations: auto-inject organizationId
            if (organizationId && modelsWithTenant.includes(model) && operation === 'create') {
              args.data = args.data || {};
              args.data['organizationId'] = organizationId;
            }

            return query(args);
          },
        },
      },
    }) as any;
  }

  async onModuleInit() {
    await this.$connect();
  }
}
