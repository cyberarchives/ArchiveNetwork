# ARCHIVE Protocol Specification

**A**dvanced **R**eal-time **C**ommunication and **H**ierarchical **I**nformation **V**ector **E**xchange

## 1. Overview

ARCHIVE is a lightweight, binary protocol designed for high-performance multiplayer game networking. It offers efficient encoding, low overhead, and flexible message structures suitable for real-time applications.

## 2. Message Structure

Each ARCHIVE message consists of:

| Field | Size (bytes) | Description |
|-------|--------------|-------------|
| Header | 4 | Includes message type, operation code, and length |
| Payload | Variable | Contains parameters and their values |
| CRC | 2 | Checksum for error checking |

### 2.1 Header Format (4 bytes)
- Byte 0: Message Type (1 byte)
- Byte 1: Operation Code (1 byte)
- Bytes 2-3: Payload Length (2 bytes, unsigned short)

## 3. Message Types (1 byte)

| Code | Name | Description |
|------|------|-------------|
| 0x01 | SYSTEM | System-level operations |
| 0x02 | RELIABLE | Guaranteed delivery messages |
| 0x03 | UNRELIABLE | Fast, non-guaranteed messages |
| 0x04 | FRAGMENT | Part of a larger message |
| 0x05 | ACK | Acknowledgment |
| 0x06 | PING | Connectivity check |
| 0x07 | ROOM | Room management |
| 0x08 | EVENT | Game events |

## 4. Operation Codes (1 byte)

### 4.1 SYSTEM Operations (0x01)
| Code | Name | Description |
|------|------|-------------|
| 0x01 | CONNECT | Initial connection request |
| 0x02 | DISCONNECT | Graceful disconnect |
| 0x03 | AUTH | Authentication |
| 0x04 | HEARTBEAT | Keep-alive signal |

### 4.2 ROOM Operations (0x07)
| Code | Name | Description |
|------|------|-------------|
| 0x01 | CREATE | Create a new room |
| 0x02 | JOIN | Join existing room |
| 0x03 | LEAVE | Leave current room |
| 0x04 | LIST | List available rooms |
| 0x05 | PROPERTIES | Set/get room properties |

### 4.3 EVENT Operations (0x08)
| Code | Name | Description |
|------|------|-------------|
| 0x01 | RAISE | Raise an event to other players |
| 0x02 | STATE | State synchronization |
| 0x03 | SNAPSHOT | Full state snapshot |

## 5. Parameter Codes

Parameters are encoded in the payload with a specific format:
- Parameter Code (1 byte)
- Data Type (1 byte)
- Length (variable, depends on data type)
- Value (variable)

### 5.1 Common Parameter Codes
| Code | Name | Description |
|------|------|-------------|
| 0x01 | PLAYER_ID | Unique player identifier |
| 0x02 | ROOM_ID | Room identifier |
| 0x03 | TIMESTAMP | Message timestamp |
| 0x04 | SEQUENCE | Sequence number |
| 0x05 | POSITION | Player position |
| 0x06 | ROTATION | Player rotation |
| 0x07 | VELOCITY | Movement velocity |
| 0x08 | ACTION | Player action |
| 0x09 | TARGET_ID | Target entity ID |
| 0x0A | HEALTH | Entity health |
| 0x0B | PROPERTIES | Custom properties |

## 6. Data Types

| Code | Type | Size (bytes) | Description |
|------|------|--------------|-------------|
| 0x01 | BOOL | 1 | Boolean (0=false, 1=true) |
| 0x02 | BYTE | 1 | Unsigned byte (0-255) |
| 0x03 | SHORT | 2 | Signed short (-32768 to 32767) |
| 0x04 | USHORT | 2 | Unsigned short (0-65535) |
| 0x05 | INT | 4 | Signed integer |
| 0x06 | UINT | 4 | Unsigned integer |
| 0x07 | LONG | 8 | Signed long integer |
| 0x08 | FLOAT | 4 | Single-precision floating point |
| 0x09 | DOUBLE | 8 | Double-precision floating point |
| 0x0A | STRING | Variable | UTF-8 string (prefixed with length) |
| 0x0B | VECTOR2 | 8 | 2D vector (2 floats) |
| 0x0C | VECTOR3 | 12 | 3D vector (3 floats) |
| 0x0D | QUATERNION | 16 | Rotation (4 floats) |
| 0x0E | BYTE_ARRAY | Variable | Array of bytes (prefixed with length) |
| 0x0F | DICTIONARY | Variable | Key-value pairs |

## 7. Binary Encoding

ARCHIVE uses little-endian byte order for multi-byte values.

### 7.1 String Encoding
Strings are encoded as:
- Length (2 bytes, unsigned short)
- UTF-8 encoded characters

### 7.2 Array Encoding
Arrays are encoded as:
- Element Count (2 bytes, unsigned short)
- Elements encoded one after another

### 7.3 Dictionary Encoding
Dictionaries are encoded as:
- Pair Count (2 bytes, unsigned short)
- For each pair:
  - Key (encoded based on its data type)
  - Value (encoded based on its data type)

## 8. Example Messages

### 8.1 Player Join Room
```
Header:
  Message Type: 0x07 (ROOM)
  Operation: 0x02 (JOIN)
  Length: 0x0E (14 bytes)

Payload:
  Parameter: 0x01 (PLAYER_ID)
  Data Type: 0x05 (INT)
  Value: 0x00000042 (66)

  Parameter: 0x02 (ROOM_ID)
  Data Type: 0x0A (STRING)
  Length: 0x0004 (4 bytes)
  Value: "Game" (encoded as UTF-8)

CRC: 0xA1B2 (example checksum)
```

### 8.2 Player Position Update
```
Header:
  Message Type: 0x03 (UNRELIABLE)
  Operation: 0x08 (EVENT)
  Length: 0x15 (21 bytes)

Payload:
  Parameter: 0x01 (PLAYER_ID)
  Data Type: 0x05 (INT)
  Value: 0x00000042 (66)

  Parameter: 0x05 (POSITION)
  Data Type: 0x0C (VECTOR3)
  Value: [10.5, 0.0, -3.2] (encoded as 3 floats)

CRC: 0xC3D4 (example checksum)
```

## 9. Implementation Guidelines

### 9.1 Reliability Layer
For RELIABLE messages, implement:
- Sequence numbering
- Acknowledgements
- Timeout-based retransmission

### 9.2 Compression
For high-frequency updates (like position), consider:
- Delta compression (send only changes)
- Quantization of floating point values
- Interest management (send only relevant updates)

### 9.3 Security
- Implement encryption for sensitive data
- Validate all incoming messages
- Use authentication tokens for player validation

## 10. WebSocket Implementation

When using ARCHIVE over WebSockets:
1. Establish standard WebSocket connection
2. Set binary mode for WebSocket messages
3. Encode/decode ARCHIVE messages to/from binary
4. Process according to ARCHIVE message structure

## 11. Comparison with Photon

Advantages over Photon:
- Smaller message overhead
- More efficient binary encoding
- Flexible parameter system
- Custom data type support
- Open specification
- No licensing fees