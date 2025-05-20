/**
 * ARCHIVE Protocol - Message Parser
 * Advanced Real-time Communication and Hierarchical Information Vector Exchange
 */

// Import constants from writer module
const { MessageType, OperationCode, ParameterCode, DataType } = require('./constants');

/**
 * ARCHIVE Message Parser class
 */
class ArchiveParser {
    /**
     * Parse an ARCHIVE protocol message from binary data
     * @param {Buffer} buffer - Binary data to parse
     * @returns {Object} Parsed message object
     * @throws {Error} If the message is invalid or corrupted
     */
    static parse(buffer) {
        // Check minimum message size (4-byte header + 2-byte CRC)
        if (buffer.length < 6) {
            throw new Error('Message too short');
        }

        // Extract header fields
        const messageType = buffer.readUInt8(0);
        const operationCode = buffer.readUInt8(1);
        const payloadLength = buffer.readUInt16LE(2);

        // Validate message length
        if (buffer.length !== payloadLength + 6) {
            throw new Error(`Invalid message length. Expected ${payloadLength + 6}, got ${buffer.length}`);
        }

        // Extract payload and CRC
        const payload = buffer.slice(4, 4 + payloadLength);
        const messageCRC = buffer.readUInt16LE(4 + payloadLength);

        // Verify CRC
        const calculatedCRC = this._calculateCRC(buffer.slice(0, 4 + payloadLength));
        if (messageCRC !== calculatedCRC) {
            throw new Error('CRC check failed');
        }

        // Parse message content
        const messageContent = {
            messageType,
            operationCode,
            parameters: this._parseParameters(payload)
        };

        // Add human-readable type and operation names if available
        messageContent.messageTypeName = this._getMessageTypeName(messageType);
        messageContent.operationName = this._getOperationName(messageType, operationCode);

        return messageContent;
    }

    /**
     * Parse parameters from payload
     * @private
     */
    static _parseParameters(payload) {
        const parameters = {};
        let offset = 0;

        while (offset < payload.length) {
            // Extract parameter header
            const paramCode = payload.readUInt8(offset++);
            const dataType = payload.readUInt8(offset++);

            // Get parameter name if available
            const paramName = this._getParameterName(paramCode);

            // Parse value based on data type
            const [value, bytesRead] = this._parseValue(payload, offset, dataType);
            offset += bytesRead;

            // Store parameter using code and name if available
            parameters[paramCode] = value;
            if (paramName) {
                parameters[paramName] = value;
            }
        }

        return parameters;
    }

    /**
     * Parse a value from the buffer based on its data type
     * @private
     */
    static _parseValue(buffer, offset, dataType) {
        let value;
        let bytesRead = 0;

        switch (dataType) {
            case DataType.BOOL:
                value = buffer.readUInt8(offset) !== 0;
                bytesRead = 1;
                break;

            case DataType.BYTE:
                value = buffer.readUInt8(offset);
                bytesRead = 1;
                break;

            case DataType.SHORT:
                value = buffer.readInt16LE(offset);
                bytesRead = 2;
                break;

            case DataType.USHORT:
                value = buffer.readUInt16LE(offset);
                bytesRead = 2;
                break;

            case DataType.INT:
                value = buffer.readInt32LE(offset);
                bytesRead = 4;
                break;

            case DataType.UINT:
                value = buffer.readUInt32LE(offset);
                bytesRead = 4;
                break;

            case DataType.LONG:
                value = buffer.readBigInt64LE(offset);
                bytesRead = 8;
                break;

            case DataType.FLOAT:
                value = buffer.readFloatLE(offset);
                bytesRead = 4;
                break;

            case DataType.DOUBLE:
                value = buffer.readDoubleLE(offset);
                bytesRead = 8;
                break;

            case DataType.STRING:
                const stringLength = buffer.readUInt16LE(offset);
                bytesRead = 2 + stringLength;
                value = buffer.slice(offset + 2, offset + 2 + stringLength).toString('utf8');
                break;

            case DataType.VECTOR2:
                value = [
                    buffer.readFloatLE(offset),
                    buffer.readFloatLE(offset + 4)
                ];
                bytesRead = 8;
                break;

            case DataType.VECTOR3:
                value = [
                    buffer.readFloatLE(offset),
                    buffer.readFloatLE(offset + 4),
                    buffer.readFloatLE(offset + 8)
                ];
                bytesRead = 12;
                break;

            case DataType.QUATERNION:
                value = [
                    buffer.readFloatLE(offset),
                    buffer.readFloatLE(offset + 4),
                    buffer.readFloatLE(offset + 8),
                    buffer.readFloatLE(offset + 12)
                ];
                bytesRead = 16;
                break;

            case DataType.BYTE_ARRAY:
                const arrayLength = buffer.readUInt16LE(offset);
                bytesRead = 2 + arrayLength;
                value = buffer.slice(offset + 2, offset + 2 + arrayLength);
                break;

            case DataType.DICTIONARY:
                const [dict, dictBytesRead] = this._parseDictionary(buffer, offset);
                value = dict;
                bytesRead = dictBytesRead;
                break;

            default:
                throw new Error(`Unknown data type: ${dataType}`);
        }

        return [value, bytesRead];
    }

    /**
     * Parse a dictionary value
     * @private
     */
    static _parseDictionary(buffer, offset) {
        const dict = {};
        const pairCount = buffer.readUInt16LE(offset);
        let bytesRead = 2; // Start with the 2 bytes for pairCount

        for (let i = 0; i < pairCount; i++) {
            // Parse key
            const keyType = buffer.readUInt8(offset + bytesRead);
            bytesRead += 1;
            
            const [key, keyBytesRead] = this._parseValue(buffer, offset + bytesRead, keyType);
            bytesRead += keyBytesRead;

            // Parse value
            const valueType = buffer.readUInt8(offset + bytesRead);
            bytesRead += 1;
            
            const [value, valueBytesRead] = this._parseValue(buffer, offset + bytesRead, valueType);
            bytesRead += valueBytesRead;

            // Add to dictionary
            dict[key] = value;
        }

        return [dict, bytesRead];
    }

    /**
     * Calculate CRC-16 checksum (same as in writer)
     * @private
     */
    static _calculateCRC(buffer) {
        // Use Node.js built-in zlib CRC32 and take lower 16 bits
        const crc32 = require('zlib').crc32(buffer);
        return crc32 & 0xFFFF;
    }

    /**
     * Get human-readable message type name
     * @private
     */
    static _getMessageTypeName(messageType) {
        for (const [name, code] of Object.entries(MessageType)) {
            if (code === messageType) {
                return name;
            }
        }
        return 'UNKNOWN';
    }

    /**
     * Get human-readable operation name
     * @private
     */
    static _getOperationName(messageType, operationCode) {
        let operationMap;
        
        // Select the appropriate operation map based on message type
        switch (messageType) {
            case MessageType.SYSTEM:
                operationMap = OperationCode.SYSTEM;
                break;
            case MessageType.ROOM:
                operationMap = OperationCode.ROOM;
                break;
            case MessageType.EVENT:
                operationMap = OperationCode.EVENT;
                break;
            default:
                return 'UNKNOWN';
        }

        // Find the operation name
        for (const [name, code] of Object.entries(operationMap)) {
            if (code === operationCode) {
                return name;
            }
        }
        
        return 'UNKNOWN';
    }

    /**
     * Get human-readable parameter name
     * @private
     */
    static _getParameterName(paramCode) {
        for (const [name, code] of Object.entries(ParameterCode)) {
            if (code === paramCode) {
                return name;
            }
        }
        return null;
    }
}

/**
 * ARCHIVE connection helper class
 * Provides utility methods for handling ARCHIVE protocol connections
 */
class ArchiveConnection {
    /**
     * Create a new connection handler
     * @param {WebSocket} socket - WebSocket instance or similar
     */
    constructor(socket) {
        this.socket = socket;
        this.sequenceNumber = 0;
        this.pendingAcks = new Map();
        this.receivedMessages = new Map();
        
        // Set up event handlers
        this._setupEventHandlers();
    }
    
    /**
     * Set up socket event handlers
     * @private
     */
    _setupEventHandlers() {
        if (!this.socket) return;
        
        this.socket.binaryType = 'arraybuffer';
        
        this.socket.onmessage = (event) => {
            if (event.data instanceof ArrayBuffer) {
                try {
                    const message = ArchiveParser.parse(Buffer.from(event.data));
                    this._handleMessage(message);
                } catch (error) {
                    console.error('Error parsing ARCHIVE message:', error);
                }
            }
        };
    }
    
    /**
     * Handle received messages
     * @private
     */
    _handleMessage(message) {
        // Check if this is an ACK message
        if (message.messageType === MessageType.ACK) {
            this._handleAcknowledgement(message);
            return;
        }
        
        // For RELIABLE messages, send an acknowledgement
        if (message.messageType === MessageType.RELIABLE && 
            message.parameters && 
            message.parameters[ParameterCode.SEQUENCE]) {
            
            this._sendAcknowledgement(message.parameters[ParameterCode.SEQUENCE]);
        }
        
        // Emit a message event for application to handle
        if (this.onMessage) {
            this.onMessage(message);
        }
    }
    
    /**
     * Handle acknowledgement messages
     * @private
     */
    _handleAcknowledgement(message) {
        if (message.parameters && message.parameters[ParameterCode.SEQUENCE]) {
            const seqNum = message.parameters[ParameterCode.SEQUENCE];
            
            // Clear any pending retransmission
            if (this.pendingAcks.has(seqNum)) {
                const { timer } = this.pendingAcks.get(seqNum);
                clearTimeout(timer);
                this.pendingAcks.delete(seqNum);
            }
        }
    }
    
    /**
     * Send an acknowledgement for a received message
     * @private
     */
    _sendAcknowledgement(sequenceNumber) {
        const ackMessage = new ArchiveWriter(MessageType.ACK, 0x01)
            .addParameter(ParameterCode.SEQUENCE, DataType.UINT, sequenceNumber)
            .encode();
            
        this._sendRaw(ackMessage);
    }
    
    /**
     * Send a message with retransmission for reliable messages
     * @param {Buffer} messageBuffer - The encoded message
     * @param {Object} options - Options for sending
     * @param {number} options.timeout - Timeout for retransmission in ms (default: 3000)
     * @param {number} options.maxRetries - Maximum number of retries (default: 5)
     */
    send(messageBuffer, options = {}) {
        const timeout = options.timeout || 3000;
        const maxRetries = options.maxRetries || 5;
        
        this._sendRaw(messageBuffer);
        
        // Check if this is a RELIABLE message that needs acknowledgement
        try {
            const message = ArchiveParser.parse(messageBuffer);
            
            if (message.messageType === MessageType.RELIABLE &&
                message.parameters && 
                message.parameters[ParameterCode.SEQUENCE]) {
                
                const seqNum = message.parameters[ParameterCode.SEQUENCE];
                let retries = 0;
                
                // Set up retransmission
                const timer = setTimeout(() => {
                    this._retransmit(messageBuffer, seqNum, retries + 1, timeout, maxRetries);
                }, timeout);
                
                this.pendingAcks.set(seqNum, { message: messageBuffer, timer });
            }
        } catch (error) {
            console.error('Error processing outgoing message:', error);
        }
    }
    
    /**
     * Retransmit a message if no acknowledgement received
     * @private
     */
    _retransmit(messageBuffer, sequenceNumber, retries, timeout, maxRetries) {
        // Check if we should stop retrying
        if (retries > maxRetries || !this.pendingAcks.has(sequenceNumber)) {
            this.pendingAcks.delete(sequenceNumber);
            
            if (this.onError) {
                this.onError({
                    type: 'TRANSMISSION_FAILED',
                    sequenceNumber,
                    message: 'Failed to transmit message after maximum retries'
                });
            }
            return;
        }
        
        // Resend the message
        this._sendRaw(messageBuffer);
        
        // Set up next retry
        const timer = setTimeout(() => {
            this._retransmit(messageBuffer, sequenceNumber, retries + 1, timeout, maxRetries);
        }, timeout);
        
        this.pendingAcks.set(sequenceNumber, { message: messageBuffer, timer });
    }
    
    /**
     * Low-level send method
     * @private
     */
    _sendRaw(messageBuffer) {
        if (this.socket && this.socket.readyState === 1) { // 1 = OPEN
            this.socket.send(messageBuffer);
        }
    }
    
    /**
     * Get the next sequence number for reliable messaging
     * @returns {number} Next sequence number
     */
    getNextSequence() {
        this.sequenceNumber = (this.sequenceNumber + 1) % 0xFFFFFFFF; // 32-bit wraparound
        return this.sequenceNumber;
    }
    
    /**
     * Close the connection and clean up resources
     */
    close() {
        // Clear all pending acknowledgements
        for (const { timer } of this.pendingAcks.values()) {
            clearTimeout(timer);
        }
        this.pendingAcks.clear();
        
        // Close the socket if it's open
        if (this.socket && this.socket.readyState === 1) {
            this.socket.close();
        }
    }
}

module.exports = {
    ArchiveParser,
    ArchiveConnection
};