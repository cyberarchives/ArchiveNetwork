/**
 * ARCHIVE Protocol - Example Usage
 */

const WebSocket = require('ws');
const { ArchiveWriter } = require("./writer");
const { MessageType, OperationCode, ParameterCode, DataType } = require('./constants');
const { ArchiveParser, ArchiveConnection } = require('./parser');

// Example 1: Creating a player join room message
function createJoinRoomMessage() {
    console.log("Example 1: Creating a player join room message");
    
    const writer = new ArchiveWriter(MessageType.ROOM, OperationCode.ROOM.JOIN)
        .addParameter(ParameterCode.PLAYER_ID, DataType.INT, 66)
        .addParameter(ParameterCode.ROOM_ID, DataType.STRING, "Game");
    
    const message = writer.encode();
    console.log("Message created:", message);
    
    // Parse the message back to verify
    const parsed = ArchiveParser.parse(message);
    console.log("Parsed message:", JSON.stringify(parsed, null, 2));
    console.log();
}

// Example 2: Creating a player position update message
function createPositionUpdateMessage() {
    console.log("Example 2: Creating a player position update message");
    
    const writer = new ArchiveWriter(MessageType.UNRELIABLE, 0x08)
        .addParameter(ParameterCode.PLAYER_ID, DataType.INT, 66)
        .addParameter(ParameterCode.POSITION, DataType.VECTOR3, [10.5, 0.0, -3.2]);
    
    const message = writer.encode();
    console.log("Message created:", message);
    
    // Parse the message back to verify
    const parsed = ArchiveParser.parse(message);
    console.log("Parsed message:", JSON.stringify(parsed, null, 2));
    console.log();
}

// Example 3: Creating a complex message with nested structures
function createComplexMessage() {
    console.log("Example 3: Creating a complex message with properties dictionary");
    
    const properties = {
        name: "Player One",
        level: 42,
        team: "Blue",
        stats: {
            health: 100,
            mana: 75,
            speed: 1.5
        },
        equipment: ["Sword", "Shield", "Potion"]
    };
    
    const writer = new ArchiveWriter(MessageType.RELIABLE, 0x01)
        .addParameter(ParameterCode.PLAYER_ID, DataType.INT, 123)
        .addParameter(ParameterCode.SEQUENCE, DataType.UINT, 456)
        .addParameter(ParameterCode.TIMESTAMP, DataType.UINT, Date.now())
        .addParameter(ParameterCode.PROPERTIES, DataType.DICTIONARY, properties);
    
    const message = writer.encode();
    console.log("Message created:", message);
    
    // Parse the message back to verify
    const parsed = ArchiveParser.parse(message);
    console.log("Parsed message:", JSON.stringify(parsed, null, 2));
    console.log();
}

// Example 4: Setting up a WebSocket server and client with ARCHIVE protocol
function setupWebSocketExample() {
    console.log("Example 4: WebSocket server and client with ARCHIVE protocol");
    console.log("Starting WebSocket server on port 8080...");
    
    // Create a WebSocket server
    const server = new WebSocket.Server({ port: 8080 });
    
    server.on('connection', (socket) => {
        console.log("Server: Client connected");
        
        // Create an ARCHIVE connection for the server
        const serverConnection = new ArchiveConnection(socket);
        
        // Handle messages
        serverConnection.onMessage = (message) => {
            console.log("Server received:", JSON.stringify(message, null, 2));
            
            // Respond to CONNECT message with AUTH
            if (message.messageType === MessageType.SYSTEM && 
                message.operationCode === OperationCode.SYSTEM.CONNECT) {
                
                console.log("Server: Sending AUTH response");
                
                const authResponse = new ArchiveWriter(MessageType.SYSTEM, OperationCode.SYSTEM.AUTH)
                    .addParameter(ParameterCode.PLAYER_ID, DataType.INT, 42)
                    .addParameter(ParameterCode.TIMESTAMP, DataType.UINT, Date.now())
                    .encode();
                
                serverConnection.send(authResponse);
            }
        };
        
        // Handle errors
        serverConnection.onError = (error) => {
            console.error("Server error:", error);
        };
    });
    
    // Wait a bit for the server to start
    setTimeout(() => {
        console.log("Starting WebSocket client...");
        
        // Create a WebSocket client
        const clientSocket = new WebSocket('ws://localhost:8080');
        
        clientSocket.on('open', () => {
            console.log("Client: Connected to server");
            
            // Create an ARCHIVE connection for the client
            const clientConnection = new ArchiveConnection(clientSocket);
            
            // Handle messages
            clientConnection.onMessage = (message) => {
                console.log("Client received:", JSON.stringify(message, null, 2));
                
                // Respond to AUTH with a JOIN ROOM message
                if (message.messageType === MessageType.SYSTEM && 
                    message.operationCode === OperationCode.SYSTEM.AUTH) {
                    
                    console.log("Client: Sending JOIN ROOM message");
                    
                    const joinRoom = new ArchiveWriter(MessageType.ROOM, OperationCode.ROOM.JOIN)
                        .addParameter(ParameterCode.PLAYER_ID, DataType.INT, 42)
                        .addParameter(ParameterCode.ROOM_ID, DataType.STRING, "Lobby")
                        .encode();
                    
                    clientConnection.send(joinRoom);
                    
                    // Send a RELIABLE message to test acknowledgements
                    console.log("Client: Sending a RELIABLE message");
                    
                    const reliableMsg = new ArchiveWriter(MessageType.RELIABLE, 0x01)
                        .addParameter(ParameterCode.PLAYER_ID, DataType.INT, 42)
                        .addParameter(ParameterCode.SEQUENCE, DataType.UINT, clientConnection.getNextSequence())
                        .addParameter(ParameterCode.POSITION, DataType.VECTOR3, [1.0, 2.0, 3.0])
                        .encode();
                    
                    clientConnection.send(reliableMsg);
                }
            };
            
            // Send initial CONNECT message
            const connectMsg = new ArchiveWriter(MessageType.SYSTEM, OperationCode.SYSTEM.CONNECT)
                .addParameter(ParameterCode.TIMESTAMP, DataType.UINT, Date.now())
                .encode();
            
            clientConnection.send(connectMsg);
        });
        
        // Clean up after 5 seconds to end the example
        setTimeout(() => {
            console.log("Closing connections...");
            clientSocket.close();
            server.close();
            console.log("Example complete");
        }, 5000);
    }, 1000);
}

// Run the examples
function runExamples() {
    createJoinRoomMessage();
    createPositionUpdateMessage();
    createComplexMessage();
    
    // Uncommenting this would run the WebSocket example
    // setupWebSocketExample();
}

runExamples();