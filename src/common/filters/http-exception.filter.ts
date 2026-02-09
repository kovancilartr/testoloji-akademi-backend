import {
    ExceptionFilter,
    Catch,
    ArgumentsHost,
    HttpException,
    HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
    catch(exception: any, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();

        const status =
            exception instanceof HttpException
                ? exception.getStatus()
                : HttpStatus.INTERNAL_SERVER_ERROR;

        const exceptionResponse = exception instanceof HttpException
            ? exception.getResponse()
            : null;

        let message = 'Hata oluştu';
        let code = 'SERVER_ERROR';
        let details = null;

        if (exception instanceof HttpException) {
            if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
                message = (exceptionResponse as any).message || exception.message;
                code = (exceptionResponse as any).error || 'API_ERROR';
                details = (exceptionResponse as any).message;
            } else {
                message = exception.message;
            }
        } else {
            message = exception.message || 'Internal server error';
            console.error('Unhandled Exception:', exception);
        }

        response.status(status).json({
            success: false,
            message,
            data: null,
            timestamp: new Date().toISOString(),
            error: {
                code,
                details,
            },
        });
    }
}
