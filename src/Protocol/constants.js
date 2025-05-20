/**
 * ARCHIVE Protocol - Message Writer
 * Advanced Real-time Communication and Hierarchical Information Vector Exchange
 */

// Constants for message types
const MessageType = {
    SYSTEM: 0x01,
    RELIABLE: 0x02,
    UNRELIABLE: 0x03,
    FRAGMENT: 0x04,
    ACK: 0x05,
    PING: 0x06,
    ROOM: 0x07,
    EVENT: 0x08
};

// Operation codes by message type
const OperationCode = {
    SYSTEM: {
        CONNECT: 0x01,
        DISCONNECT: 0x02,
        AUTH: 0x03,
        HEARTBEAT: 0x04
    },
    ROOM: {
        CREATE: 0x01,
        JOIN: 0x02,
        LEAVE: 0x03,
        LIST: 0x04,
        PROPERTIES: 0x05
    },
    EVENT: {
        RAISE: 0x01,
        STATE: 0x02,
        SNAPSHOT: 0x03
    }
};

// Parameter codes
const ParameterCode = {
    PLAYER_ID: 0x01,
    ROOM_ID: 0x02,
    TIMESTAMP: 0x03,
    SEQUENCE: 0x04,
    POSITION: 0x05,
    ROTATION: 0x06,
    VELOCITY: 0x07,
    ACTION: 0x08,
    TARGET_ID: 0x09,
    HEALTH: 0x0A,
    PROPERTIES: 0x0B
};

// Data types
const DataType = {
    BOOL: 0x01,
    BYTE: 0x02,
    SHORT: 0x03,
    USHORT: 0x04,
    INT: 0x05,
    UINT: 0x06,
    LONG: 0x07,
    FLOAT: 0x08,
    DOUBLE: 0x09,
    STRING: 0x0A,
    VECTOR2: 0x0B,
    VECTOR3: 0x0C,
    QUATERNION: 0x0D,
    BYTE_ARRAY: 0x0E,
    DICTIONARY: 0x0F
};

module.exports = {
    MessageType,
    OperationCode,
    ParameterCode,
    DataType
};