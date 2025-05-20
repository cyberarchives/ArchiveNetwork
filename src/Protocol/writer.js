const { DataType } = require('./constants');

/**
 * ARCHIVE Message Writer class
 */
class ArchiveWriter {
    /**
     * Create a new ARCHIVE message
     * @param {number} messageType - The message type (from MessageType enum)
     * @param {number} operationCode - The operation code
     * @returns {ArchiveWriter} - The message writer instance for chaining
     */
    constructor(messageType, operationCode) {
        this.messageType = messageType;
        this.operationCode = operationCode;
        this.payload = Buffer.alloc(0);
        return this;
    }

    /**
     * Add a parameter to the message
     * @param {number} paramCode - The parameter code (from ParameterCode enum)
     * @param {number} dataType - The data type (from DataType enum)
     * @param {*} value - The parameter value
     * @returns {ArchiveWriter} - The message writer instance for chaining
     */
    addParameter(paramCode, dataType, value) {
        // Create a temporary buffer for the parameter
        let paramBuffer;
        
        // Parameter code (1 byte) + Data type (1 byte)
        const headerBuffer = Buffer.alloc(2);
        headerBuffer.writeUInt8(paramCode, 0);
        headerBuffer.writeUInt8(dataType, 1);
        
        // Encode the value based on its data type
        let valueBuffer;
        switch (dataType) {
            case DataType.BOOL:
                valueBuffer = Buffer.alloc(1);
                valueBuffer.writeUInt8(value ? 1 : 0, 0);
                break;
                
            case DataType.BYTE:
                valueBuffer = Buffer.alloc(1);
                valueBuffer.writeUInt8(value, 0);
                break;
                
            case DataType.SHORT:
                valueBuffer = Buffer.alloc(2);
                valueBuffer.writeInt16LE(value, 0);
                break;
                
            case DataType.USHORT:
                valueBuffer = Buffer.alloc(2);
                valueBuffer.writeUInt16LE(value, 0);
                break;
                
            case DataType.INT:
                valueBuffer = Buffer.alloc(4);
                valueBuffer.writeInt32LE(value, 0);
                break;
                
            case DataType.UINT:
                valueBuffer = Buffer.alloc(4);
                valueBuffer.writeUInt32LE(value, 0);
                break;
                
            case DataType.LONG:
                valueBuffer = Buffer.alloc(8);
                // Use BigInt for long values
                if (typeof value !== 'bigint') {
                    value = BigInt(value);
                }
                valueBuffer.writeBigInt64LE(value, 0);
                break;
                
            case DataType.FLOAT:
                valueBuffer = Buffer.alloc(4);
                valueBuffer.writeFloatLE(value, 0);
                break;
                
            case DataType.DOUBLE:
                valueBuffer = Buffer.alloc(8);
                valueBuffer.writeDoubleLE(value, 0);
                break;
                
            case DataType.STRING:
                // String length (2 bytes) + UTF-8 encoded string
                const stringBuffer = Buffer.from(value, 'utf8');
                const lengthBuffer = Buffer.alloc(2);
                lengthBuffer.writeUInt16LE(stringBuffer.length, 0);
                valueBuffer = Buffer.concat([lengthBuffer, stringBuffer]);
                break;
                
            case DataType.VECTOR2:
                valueBuffer = Buffer.alloc(8);
                valueBuffer.writeFloatLE(value[0], 0);
                valueBuffer.writeFloatLE(value[1], 4);
                break;
                
            case DataType.VECTOR3:
                valueBuffer = Buffer.alloc(12);
                valueBuffer.writeFloatLE(value[0], 0);
                valueBuffer.writeFloatLE(value[1], 4);
                valueBuffer.writeFloatLE(value[2], 8);
                break;
                
            case DataType.QUATERNION:
                valueBuffer = Buffer.alloc(16);
                valueBuffer.writeFloatLE(value[0], 0);
                valueBuffer.writeFloatLE(value[1], 4);
                valueBuffer.writeFloatLE(value[2], 8);
                valueBuffer.writeFloatLE(value[3], 12);
                break;
                
            case DataType.BYTE_ARRAY:
                // Array length (2 bytes) + array data
                const lengthBuf = Buffer.alloc(2);
                lengthBuf.writeUInt16LE(value.length, 0);
                valueBuffer = Buffer.concat([lengthBuf, Buffer.from(value)]);
                break;
                
            case DataType.DICTIONARY:
                // Handle dictionary encoding
                const pairs = Object.entries(value);
                const pairCountBuffer = Buffer.alloc(2);
                pairCountBuffer.writeUInt16LE(pairs.length, 0);
                
                // Start with the pair count
                let dictBuffers = [pairCountBuffer];
                
                // For each key-value pair, encode both the key and value
                for (const [key, val] of pairs) {
                    // For simplicity, assume keys are always strings
                    const keyTypeBuffer = Buffer.alloc(1);
                    keyTypeBuffer.writeUInt8(DataType.STRING, 0);
                    
                    const keyString = Buffer.from(key, 'utf8');
                    const keyLengthBuffer = Buffer.alloc(2);
                    keyLengthBuffer.writeUInt16LE(keyString.length, 0);
                    
                    // Determine value type and encode
                    const [valTypeBuffer, encodedVal] = this._encodeValue(val);
                    
                    dictBuffers.push(
                        keyTypeBuffer,
                        keyLengthBuffer,
                        keyString,
                        valTypeBuffer,
                        encodedVal
                    );
                }
                
                valueBuffer = Buffer.concat(dictBuffers);
                break;
                
            default:
                throw new Error(`Unsupported data type: ${dataType}`);
        }
        
        // Combine parameter header and value
        paramBuffer = Buffer.concat([headerBuffer, valueBuffer]);
        
        // Add to the payload
        this.payload = Buffer.concat([this.payload, paramBuffer]);
        
        return this;
    }
    
    /**
     * Helper method to encode a value based on its JavaScript type
     * @private
     */
    _encodeValue(value) {
        let typeBuffer = Buffer.alloc(1);
        let valueBuffer;
        
        if (typeof value === 'boolean') {
            typeBuffer.writeUInt8(DataType.BOOL, 0);
            valueBuffer = Buffer.alloc(1);
            valueBuffer.writeUInt8(value ? 1 : 0, 0);
        }
        else if (typeof value === 'number') {
            if (Number.isInteger(value)) {
                if (value >= 0 && value <= 255) {
                    typeBuffer.writeUInt8(DataType.BYTE, 0);
                    valueBuffer = Buffer.alloc(1);
                    valueBuffer.writeUInt8(value, 0);
                } else if (value >= -32768 && value <= 32767) {
                    typeBuffer.writeUInt8(DataType.SHORT, 0);
                    valueBuffer = Buffer.alloc(2);
                    valueBuffer.writeInt16LE(value, 0);
                } else {
                    typeBuffer.writeUInt8(DataType.INT, 0);
                    valueBuffer = Buffer.alloc(4);
                    valueBuffer.writeInt32LE(value, 0);
                }
            } else {
                typeBuffer.writeUInt8(DataType.FLOAT, 0);
                valueBuffer = Buffer.alloc(4);
                valueBuffer.writeFloatLE(value, 0);
            }
        }
        else if (typeof value === 'string') {
            typeBuffer.writeUInt8(DataType.STRING, 0);
            const stringBuffer = Buffer.from(value, 'utf8');
            const lengthBuffer = Buffer.alloc(2);
            lengthBuffer.writeUInt16LE(stringBuffer.length, 0);
            valueBuffer = Buffer.concat([lengthBuffer, stringBuffer]);
        }
        else if (Array.isArray(value)) {
            if (value.length === 2 && value.every(v => typeof v === 'number')) {
                typeBuffer.writeUInt8(DataType.VECTOR2, 0);
                valueBuffer = Buffer.alloc(8);
                valueBuffer.writeFloatLE(value[0], 0);
                valueBuffer.writeFloatLE(value[1], 4);
            }
            else if (value.length === 3 && value.every(v => typeof v === 'number')) {
                typeBuffer.writeUInt8(DataType.VECTOR3, 0);
                valueBuffer = Buffer.alloc(12);
                valueBuffer.writeFloatLE(value[0], 0);
                valueBuffer.writeFloatLE(value[1], 4);
                valueBuffer.writeFloatLE(value[2], 8);
            }
            else if (value.length === 4 && value.every(v => typeof v === 'number')) {
                typeBuffer.writeUInt8(DataType.QUATERNION, 0);
                valueBuffer = Buffer.alloc(16);
                valueBuffer.writeFloatLE(value[0], 0);
                valueBuffer.writeFloatLE(value[1], 4);
                valueBuffer.writeFloatLE(value[2], 8);
                valueBuffer.writeFloatLE(value[3], 12);
            }
            else {
                // Default to byte array
                typeBuffer.writeUInt8(DataType.BYTE_ARRAY, 0);
                const lengthBuffer = Buffer.alloc(2);
                lengthBuffer.writeUInt16LE(value.length, 0);
                valueBuffer = Buffer.concat([lengthBuffer, Buffer.from(value)]);
            }
        }
        else if (typeof value === 'object' && value !== null) {
            // Handle objects as dictionaries
            typeBuffer.writeUInt8(DataType.DICTIONARY, 0);
            
            const pairs = Object.entries(value);
            const pairCountBuffer = Buffer.alloc(2);
            pairCountBuffer.writeUInt16LE(pairs.length, 0);
            
            // Start with the pair count
            let dictBuffers = [pairCountBuffer];
            
            // For each key-value pair, encode both the key and value recursively
            for (const [key, val] of pairs) {
                // For simplicity, assume keys are always strings
                const keyTypeBuffer = Buffer.alloc(1);
                keyTypeBuffer.writeUInt8(DataType.STRING, 0);
                
                const keyString = Buffer.from(key, 'utf8');
                const keyLengthBuffer = Buffer.alloc(2);
                keyLengthBuffer.writeUInt16LE(keyString.length, 0);
                
                // Recursively encode nested value
                const [valTypeBuffer, encodedVal] = this._encodeValue(val);
                
                dictBuffers.push(
                    keyTypeBuffer,
                    keyLengthBuffer,
                    keyString,
                    valTypeBuffer,
                    encodedVal
                );
            }
            
            valueBuffer = Buffer.concat(dictBuffers);
        }
        else {
            throw new Error(`Unsupported value type: ${typeof value}`);
        }
        
        return [typeBuffer, valueBuffer];
    }

    /**
     * Calculate CRC-16 checksum
     * @private
     */
    _calculateCRC(buffer) {
        // Use Node.js built-in zlib CRC32 and take lower 16 bits
        const crc32 = require('zlib').crc32(buffer);
        return crc32 & 0xFFFF;
    }

    /**
     * Finalize and encode the message to a binary buffer
     * @returns {Buffer} The encoded message as a Buffer
     */
    encode() {
        // Create header (4 bytes)
        const header = Buffer.alloc(4);
        header.writeUInt8(this.messageType, 0);
        header.writeUInt8(this.operationCode, 1);
        header.writeUInt16LE(this.payload.length, 2);
        
        // Combine header and payload
        const messageWithoutCRC = Buffer.concat([header, this.payload]);
        
        // Calculate CRC (2 bytes)
        const crc = this._calculateCRC(messageWithoutCRC);
        const crcBuffer = Buffer.alloc(2);
        crcBuffer.writeUInt16LE(crc, 0);
        
        // Combine everything
        return Buffer.concat([messageWithoutCRC, crcBuffer]);
    }
}

module.exports = { ArchiveWriter, };