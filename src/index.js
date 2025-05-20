/**
 * ARCHIVE Protocol Server
 * Manages rooms, connected clients, authentication, and message handling
 */

const WebSocket = require('ws');
const crypto = require('crypto');
const { ArchiveWriter } = require('./Protocol/writer');
const { ArchiveParser, ArchiveConnection } = require('./Protocol/parser');
const { MessageType, OperationCode, ParameterCode, DataType } = require('./Protocol/constants');

class ArchiveServer {
  constructor(port = 8080) {
    this.port = port;
    this.server = null;
    this.clients = new Map(); // Map of client connections by client ID
    this.rooms = new Map(); // Map of rooms by room ID
    this.authTokens = new Map(); // Map of auth tokens to client IDs
    
    // Sequence counters for reliable messages
    this.sequences = new Map();
    
    this.setupServer();
  }
  
  setupServer() {
    this.server = new WebSocket.Server({ port: this.port });
    
    this.server.on('connection', (socket, request) => {
      const clientId = this.generateClientId();
      const clientIp = request.socket.remoteAddress;
      
      console.log(`New connection from ${clientIp}, assigned client ID: ${clientId}`);
      
      // Create an ARCHIVE connection for this client
      const connection = new ArchiveConnection(socket);
      
      // Store client information
      this.clients.set(clientId, {
        id: clientId,
        ip: clientIp,
        connection: connection,
        isAuthenticated: false,
        playerId: null,
        currentRoom: null,
        properties: {}
      });
      
      // Set up message handler
      connection.onMessage = (message) => {
        this.handleMessage(clientId, message);
      };
      
      // Set up error handler
      connection.onError = (error) => {
        console.error(`Error for client ${clientId}:`, error);
      };
      
      // Set up close handler
      socket.on('close', () => {
        this.handleClientDisconnect(clientId);
      });
    });
    
    console.log(`ARCHIVE server started on port ${this.port}`);
  }
  
  /**
   * Handles incoming messages from clients
   */
  handleMessage(clientId, message) {
    const client = this.clients.get(clientId);
    
    if (!client) {
      console.error(`Received message from unknown client ID: ${clientId}`);
      return;
    }
    
    console.log(`Received ${MessageType[message.messageType]} message from client ${clientId}`);
    
    // Process message based on its type
    switch (message.messageType) {
      case MessageType.SYSTEM:
        this.handleSystemMessage(clientId, message);
        break;
        
      case MessageType.RELIABLE:
        this.handleReliableMessage(clientId, message);
        break;
        
      case MessageType.UNRELIABLE:
        this.handleUnreliableMessage(clientId, message);
        break;
        
      case MessageType.ROOM:
        this.handleRoomMessage(clientId, message);
        break;
        
      case MessageType.EVENT:
        this.handleEventMessage(clientId, message);
        break;
        
      case MessageType.PING:
        this.handlePingMessage(clientId, message);
        break;
        
      case MessageType.ACK:
        this.handleAckMessage(clientId, message);
        break;
        
      default:
        console.warn(`Unhandled message type ${message.messageType} from client ${clientId}`);
    }
  }
  
  /**
   * Handle system-level messages
   */
  handleSystemMessage(clientId, message) {
    const client = this.clients.get(clientId);
    
    switch (message.operationCode) {
      case OperationCode.SYSTEM.CONNECT:
        console.log(`Client ${clientId} requesting connection`);
        
        // Generate authentication token
        const authToken = this.generateAuthToken();
        this.authTokens.set(authToken, clientId);
        
        // Send AUTH response with token
        const authResponse = new ArchiveWriter(MessageType.SYSTEM, OperationCode.SYSTEM.AUTH)
          .addParameter(ParameterCode.PLAYER_ID, DataType.INT, clientId)
          .addParameter(ParameterCode.TIMESTAMP, DataType.UINT, Date.now())
          .addParameter(ParameterCode.PROPERTIES, DataType.STRING, authToken)
          .encode();
        
        client.connection.send(authResponse);
        break;
        
      case OperationCode.SYSTEM.AUTH:
        const authTokenParam = this.getParameterValue(message, ParameterCode.PROPERTIES);
        const playerIdParam = this.getParameterValue(message, ParameterCode.PLAYER_ID);
        
        if (authTokenParam && this.authTokens.get(authTokenParam) === clientId) {
          client.isAuthenticated = true;
          client.playerId = playerIdParam || clientId;
          console.log(`Client ${clientId} authenticated as player ${client.playerId}`);
          
          // Confirm authentication
          const authConfirm = new ArchiveWriter(MessageType.SYSTEM, OperationCode.SYSTEM.AUTH)
            .addParameter(ParameterCode.PLAYER_ID, DataType.INT, client.playerId)
            .addParameter(ParameterCode.TIMESTAMP, DataType.UINT, Date.now())
            .addParameter(ParameterCode.PROPERTIES, DataType.BOOL, true) // Success flag
            .encode();
          
          client.connection.send(authConfirm);
        } else {
          console.log(`Client ${clientId} failed authentication`);
          // Send authentication failure
          const authFail = new ArchiveWriter(MessageType.SYSTEM, OperationCode.SYSTEM.AUTH)
            .addParameter(ParameterCode.TIMESTAMP, DataType.UINT, Date.now())
            .addParameter(ParameterCode.PROPERTIES, DataType.BOOL, false) // Failure flag
            .encode();
          
          client.connection.send(authFail);
        }
        break;
        
      case OperationCode.SYSTEM.DISCONNECT:
        console.log(`Client ${clientId} requested disconnect`);
        this.handleClientDisconnect(clientId);
        break;
        
      case OperationCode.SYSTEM.HEARTBEAT:
        // Just acknowledge heartbeat
        const heartbeatResponse = new ArchiveWriter(MessageType.SYSTEM, OperationCode.SYSTEM.HEARTBEAT)
          .addParameter(ParameterCode.TIMESTAMP, DataType.UINT, Date.now())
          .encode();
        
        client.connection.send(heartbeatResponse);
        break;
    }
  }
  
  /**
   * Handle reliable messages that require acknowledgment
   */
  handleReliableMessage(clientId, message) {
    const client = this.clients.get(clientId);
    
    if (!client.isAuthenticated) {
      console.warn(`Unauthenticated client ${clientId} sent reliable message`);
      return;
    }
    
    // Extract sequence number
    const sequence = this.getParameterValue(message, ParameterCode.SEQUENCE);
    
    if (sequence !== undefined) {
      // Send acknowledgment
      const ackMessage = new ArchiveWriter(MessageType.ACK, 0x00)
        .addParameter(ParameterCode.SEQUENCE, DataType.UINT, sequence)
        .addParameter(ParameterCode.TIMESTAMP, DataType.UINT, Date.now())
        .encode();
      
      client.connection.send(ackMessage);
      
      // Process the reliable message based on its operation code
      // Implementation would depend on the specific operation codes for reliable messages
      console.log(`Processed reliable message with sequence ${sequence} from client ${clientId}`);
      
      // Broadcast to room if client is in a room
      if (client.currentRoom) {
        this.broadcastToRoom(client.currentRoom, message, clientId);
      }
    } else {
      console.warn(`Reliable message from client ${clientId} missing sequence number`);
    }
  }
  
  /**
   * Handle unreliable messages (no acknowledgment needed)
   */
  handleUnreliableMessage(clientId, message) {
    const client = this.clients.get(clientId);
    
    if (!client.isAuthenticated) {
      console.warn(`Unauthenticated client ${clientId} sent unreliable message`);
      return;
    }
    
    // Process the unreliable message based on operation code
    // Implementation would depend on game-specific logic
    
    // Broadcast to room if client is in a room
    if (client.currentRoom) {
      this.broadcastToRoom(client.currentRoom, message, clientId);
    }
  }
  
  /**
   * Handle room-related messages
   */
  handleRoomMessage(clientId, message) {
    const client = this.clients.get(clientId);
    
    if (!client.isAuthenticated) {
      console.warn(`Unauthenticated client ${clientId} sent room message`);
      return;
    }
    
    switch (message.operationCode) {
      case OperationCode.ROOM.CREATE:
        const createRoomId = this.getParameterValue(message, ParameterCode.ROOM_ID);
        
        if (createRoomId && !this.rooms.has(createRoomId)) {
          // Create new room
          this.rooms.set(createRoomId, {
            id: createRoomId,
            players: new Set(),
            properties: {}
          });
          
          console.log(`Client ${clientId} created room ${createRoomId}`);
          
          // Join the created room
          this.joinRoom(clientId, createRoomId);
          
          // Send confirmation
          const createResponse = new ArchiveWriter(MessageType.ROOM, OperationCode.ROOM.CREATE)
            .addParameter(ParameterCode.ROOM_ID, DataType.STRING, createRoomId)
            .addParameter(ParameterCode.PROPERTIES, DataType.BOOL, true) // Success flag
            .encode();
          
          client.connection.send(createResponse);
        } else {
          // Room exists or invalid ID
          const createFailResponse = new ArchiveWriter(MessageType.ROOM, OperationCode.ROOM.CREATE)
            .addParameter(ParameterCode.ROOM_ID, DataType.STRING, createRoomId || "")
            .addParameter(ParameterCode.PROPERTIES, DataType.BOOL, false) // Failure flag
            .encode();
          
          client.connection.send(createFailResponse);
        }
        break;
        
      case OperationCode.ROOM.JOIN:
        const joinRoomId = this.getParameterValue(message, ParameterCode.ROOM_ID);
        
        if (joinRoomId && this.rooms.has(joinRoomId)) {
          // Join room
          const success = this.joinRoom(clientId, joinRoomId);
          
          if (success) {
            console.log(`Client ${clientId} joined room ${joinRoomId}`);
            
            // Send confirmation
            const joinResponse = new ArchiveWriter(MessageType.ROOM, OperationCode.ROOM.JOIN)
              .addParameter(ParameterCode.ROOM_ID, DataType.STRING, joinRoomId)
              .addParameter(ParameterCode.PROPERTIES, DataType.BOOL, true) // Success flag
              .encode();
            
            client.connection.send(joinResponse);
            
            // Notify other players in the room
            this.notifyPlayerJoined(joinRoomId, clientId);
          } else {
            const joinFailResponse = new ArchiveWriter(MessageType.ROOM, OperationCode.ROOM.JOIN)
              .addParameter(ParameterCode.ROOM_ID, DataType.STRING, joinRoomId)
              .addParameter(ParameterCode.PROPERTIES, DataType.BOOL, false) // Failure flag
              .encode();
            
            client.connection.send(joinFailResponse);
          }
        } else {
          // Room doesn't exist
          const joinFailResponse = new ArchiveWriter(MessageType.ROOM, OperationCode.ROOM.JOIN)
            .addParameter(ParameterCode.ROOM_ID, DataType.STRING, joinRoomId || "")
            .addParameter(ParameterCode.PROPERTIES, DataType.BOOL, false) // Failure flag
            .encode();
          
          client.connection.send(joinFailResponse);
        }
        break;
        
      case OperationCode.ROOM.LEAVE:
        const leaveRoomId = client.currentRoom;
        
        if (leaveRoomId) {
          this.leaveRoom(clientId, leaveRoomId);
          console.log(`Client ${clientId} left room ${leaveRoomId}`);
          
          // Send confirmation
          const leaveResponse = new ArchiveWriter(MessageType.ROOM, OperationCode.ROOM.LEAVE)
            .addParameter(ParameterCode.ROOM_ID, DataType.STRING, leaveRoomId)
            .addParameter(ParameterCode.PROPERTIES, DataType.BOOL, true) // Success flag
            .encode();
          
          client.connection.send(leaveResponse);
        } else {
          // Not in a room
          const leaveFailResponse = new ArchiveWriter(MessageType.ROOM, OperationCode.ROOM.LEAVE)
            .addParameter(ParameterCode.PROPERTIES, DataType.BOOL, false) // Failure flag
            .encode();
          
          client.connection.send(leaveFailResponse);
        }
        break;
        
      case OperationCode.ROOM.LIST:
        // Return list of available rooms
        const roomList = Array.from(this.rooms.keys());
        
        const listResponse = new ArchiveWriter(MessageType.ROOM, OperationCode.ROOM.LIST)
          .addParameter(ParameterCode.PROPERTIES, DataType.BYTE_ARRAY, JSON.stringify(roomList))
          .encode();
        
        client.connection.send(listResponse);
        break;
        
      case OperationCode.ROOM.PROPERTIES:
        // Handle room property changes
        const roomPropsId = client.currentRoom;
        
        if (roomPropsId) {
          const properties = this.getParameterValue(message, ParameterCode.PROPERTIES);
          
          if (properties) {
            // Update room properties
            const room = this.rooms.get(roomPropsId);
            room.properties = {...room.properties, ...properties};
            
            console.log(`Updated properties for room ${roomPropsId}`);
            
            // Notify all players in the room
            this.broadcastRoomProperties(roomPropsId);
          }
        }
        break;
    }
  }
  
  /**
   * Handle game event messages
   */
  handleEventMessage(clientId, message) {
    const client = this.clients.get(clientId);
    
    if (!client.isAuthenticated) {
      console.warn(`Unauthenticated client ${clientId} sent event message`);
      return;
    }
    
    if (!client.currentRoom) {
      console.warn(`Client ${clientId} sent event but is not in a room`);
      return;
    }
    
    switch (message.operationCode) {
      case OperationCode.EVENT.RAISE:
        // Broadcast event to all players in the room
        this.broadcastToRoom(client.currentRoom, message, clientId);
        break;
        
      case OperationCode.EVENT.STATE:
        // Handle state update
        // Could be player position, rotation, or other state
        const playerId = this.getParameterValue(message, ParameterCode.PLAYER_ID);
        
        if (playerId !== undefined) {
          // Broadcast state update to room
          this.broadcastToRoom(client.currentRoom, message, clientId);
        }
        break;
        
      case OperationCode.EVENT.SNAPSHOT:
        // Full state snapshot
        // Usually only sent by authority (server)
        // But could be used for client authority
        this.broadcastToRoom(client.currentRoom, message, clientId);
        break;
    }
  }
  
  /**
   * Handle ping messages for latency measurement
   */
  handlePingMessage(clientId, message) {
    const client = this.clients.get(clientId);
    
    // Simply echo back the ping with a timestamp
    const pingResponse = new ArchiveWriter(MessageType.PING, 0x00)
      .addParameter(ParameterCode.TIMESTAMP, DataType.UINT, Date.now())
      .encode();
    
    client.connection.send(pingResponse);
  }
  
  /**
   * Handle acknowledgment messages for reliable transmission
   */
  handleAckMessage(clientId, message) {
    const client = this.clients.get(clientId);
    
    const sequence = this.getParameterValue(message, ParameterCode.SEQUENCE);
    
    if (sequence !== undefined) {
      // Process acknowledgment
      // This would typically involve removing the message from a resend queue
      console.log(`Received ACK for sequence ${sequence} from client ${clientId}`);
    }
  }
  
  /**
   * Join a client to a room
   */
  joinRoom(clientId, roomId) {
    const client = this.clients.get(clientId);
    const room = this.rooms.get(roomId);
    
    if (!client || !room) {
      return false;
    }
    
    // If client is already in a room, leave it first
    if (client.currentRoom) {
      this.leaveRoom(clientId, client.currentRoom);
    }
    
    // Add client to room
    room.players.add(clientId);
    client.currentRoom = roomId;
    
    return true;
  }
  
  /**
   * Remove a client from a room
   */
  leaveRoom(clientId, roomId) {
    const client = this.clients.get(clientId);
    const room = this.rooms.get(roomId);
    
    if (!client || !room) {
      return false;
    }
    
    // Remove client from room
    room.players.delete(clientId);
    client.currentRoom = null;
    
    // Notify other players that this player left
    this.notifyPlayerLeft(roomId, clientId);
    
    // Clean up empty rooms
    if (room.players.size === 0) {
      console.log(`Room ${roomId} is empty, removing`);
      this.rooms.delete(roomId);
    }
    
    return true;
  }
  
  /**
   * Broadcast a message to all clients in a room except sender
   */
  broadcastToRoom(roomId, message, excludeClientId = null) {
    const room = this.rooms.get(roomId);
    
    if (!room) {
      return;
    }
    
    // Get the raw message to avoid re-encoding
    let rawMessage;
    if (message instanceof Uint8Array) {
      rawMessage = message;
    } else {
      // If it's a parsed object, re-encode it
      const writer = new ArchiveWriter(message.messageType, message.operationCode);
      
      // Add all parameters from the message
      if (message.parameters) {
        for (const param of message.parameters) {
          writer.addParameter(param.code, param.type, param.value);
        }
      }
      
      rawMessage = writer.encode();
    }
    
    // Send to all clients in the room except the sender
    for (const clientId of room.players) {
      if (clientId !== excludeClientId) {
        const client = this.clients.get(clientId);
        if (client && client.connection) {
          client.connection.send(rawMessage);
        }
      }
    }
  }
  
  /**
   * Notify all players in a room that a new player joined
   */
  notifyPlayerJoined(roomId, joinedClientId) {
    const client = this.clients.get(joinedClientId);
    
    if (!client) {
      return;
    }
    
    const joinNotification = new ArchiveWriter(MessageType.ROOM, OperationCode.ROOM.JOIN)
      .addParameter(ParameterCode.PLAYER_ID, DataType.INT, client.playerId)
      .addParameter(ParameterCode.ROOM_ID, DataType.STRING, roomId)
      .encode();
    
    this.broadcastToRoom(roomId, joinNotification, joinedClientId);
  }
  
  /**
   * Notify all players in a room that a player left
   */
  notifyPlayerLeft(roomId, leftClientId) {
    const client = this.clients.get(leftClientId);
    
    if (!client) {
      return;
    }
    
    const leaveNotification = new ArchiveWriter(MessageType.ROOM, OperationCode.ROOM.LEAVE)
      .addParameter(ParameterCode.PLAYER_ID, DataType.INT, client.playerId)
      .addParameter(ParameterCode.ROOM_ID, DataType.STRING, roomId)
      .encode();
    
    this.broadcastToRoom(roomId, leaveNotification);
  }
  
  /**
   * Broadcast room properties to all players in a room
   */
  broadcastRoomProperties(roomId) {
    const room = this.rooms.get(roomId);
    
    if (!room) {
      return;
    }
    
    const propsNotification = new ArchiveWriter(MessageType.ROOM, OperationCode.ROOM.PROPERTIES)
      .addParameter(ParameterCode.ROOM_ID, DataType.STRING, roomId)
      .addParameter(ParameterCode.PROPERTIES, DataType.DICTIONARY, room.properties)
      .encode();
    
    this.broadcastToRoom(roomId, propsNotification);
  }
  
  /**
   * Handle client disconnection
   */
  handleClientDisconnect(clientId) {
    const client = this.clients.get(clientId);
    
    if (!client) {
      return;
    }
    
    console.log(`Client ${clientId} disconnected`);
    
    // If client was in a room, remove them
    if (client.currentRoom) {
      this.leaveRoom(clientId, client.currentRoom);
    }
    
    // Clean up auth tokens
    for (const [token, id] of this.authTokens.entries()) {
      if (id === clientId) {
        this.authTokens.delete(token);
      }
    }
    
    // Remove client from clients map
    this.clients.delete(clientId);
  }
  
  /**
   * Generate a unique client ID
   */
  generateClientId() {
    return Math.floor(Math.random() * 1000000);
  }
  
  /**
   * Generate a unique authentication token
   */
  generateAuthToken() {
    return crypto.randomBytes(16).toString('hex');
  }
  
  /**
   * Helper method to extract parameter value from a message
   */
  getParameterValue(message, paramCode) {
    if (!message.parameters) {
      return undefined;
    }
    
    for (const param of message.parameters) {
      if (param.code === paramCode) {
        return param.value;
      }
    }
    
    return undefined;
  }
  
  /**
   * Shut down the server
   */
  shutdown() {
    if (this.server) {
      console.log('Shutting down ARCHIVE server');
      
      // Close all client connections
      for (const [clientId, client] of this.clients.entries()) {
        if (client.connection && client.connection.socket) {
          client.connection.socket.close();
        }
      }
      
      // Close the server
      this.server.close();
      this.server = null;
    }
  }
}

// Start the server when the module is run directly
if (require.main === module) {
  const port = process.env.PORT || 8080;
  const server = new ArchiveServer(port);
  
  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('Received SIGINT, shutting down');
    server.shutdown();
    process.exit(0);
  });
  
  process.on('SIGTERM', () => {
    console.log('Received SIGTERM, shutting down');
    server.shutdown();
    process.exit(0);
  });
}

module.exports = { ArchiveServer };