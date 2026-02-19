import {
    WebSocketGateway,
    WebSocketServer,
    SubscribeMessage,
    OnGatewayConnection,
    OnGatewayDisconnect,
    ConnectedSocket,
    MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { UseGuards } from '@nestjs/common';
import { Injectable } from '@nestjs/common';

@WebSocketGateway({
    cors: {
        origin: '*',
    },
})
@Injectable()
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server: Server;

    // Track connected clients { clientId: userId }
    private connectedClients: Map<string, string> = new Map();

    handleConnection(client: Socket) {
        // Optionally extract userId from tokens via client.handshake.auth later
        console.log(`Client connected: ${client.id}`);
    }

    handleDisconnect(client: Socket) {
        console.log(`Client disconnected: ${client.id}`);
        const userId = this.connectedClients.get(client.id);
        if (userId) {
            // client automatically leaves room on disconnect
            this.connectedClients.delete(client.id);
        }
    }

    // Client requests to join their personal room
    @SubscribeMessage('joinUserRoom')
    handleJoinRoom(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: { userId: string }
    ) {
        if (data?.userId) {
            client.join(`user_${data.userId}`);
            this.connectedClients.set(client.id, data.userId);
            console.log(`Client ${client.id} joined user room user_${data.userId}`);
            return { event: 'joined', success: true };
        }
        return { event: 'error', message: 'UserId not provided' };
    }

    // Helper method to let system emit specific events to specific users
    sendToUser(userId: string, event: string, payload: any) {
        this.server.to(`user_${userId}`).emit(event, payload);
    }
}
