using Archive3Unity3D.Realtime;
using Microsoft.VisualBasic;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net.WebSockets;
using System.Reflection;
using System.Text;
using System.Threading;
using System.Threading.Tasks;

namespace Archive3Unity3D.Realtime
{
    /// <summary>
    /// ARCHIVE Message Parser class
    /// </summary>
    public static class ArchiveParser
    {
        /// <summary>
        /// Parse an ARCHIVE protocol message from binary data
        /// </summary>
        /// <param name="buffer">Binary data to parse</param>
        /// <returns>Parsed message object</returns>
        /// <exception cref="Exception">If the message is invalid or corrupted</exception>
        public static MessageContent Parse(byte[] buffer)
        {
            // Check minimum message size (4-byte header + 2-byte CRC)
            if (buffer.Length < 6)
            {
                throw new Exception("Message too short");
            }

            using (MemoryStream stream = new MemoryStream(buffer))
            using (BinaryReader reader = new BinaryReader(stream))
            {
                // Extract header fields
                byte messageType = reader.ReadByte();
                byte operationCode = reader.ReadByte();
                ushort payloadLength = reader.ReadUInt16();

                // Validate message length
                if (buffer.Length != payloadLength + 6)
                {
                    throw new Exception($"Invalid message length. Expected {payloadLength + 6}, got {buffer.Length}");
                }

                // Extract payload and CRC
                byte[] payload = new byte[payloadLength];
                stream.Read(payload, 0, payloadLength);
                ushort messageCRC = reader.ReadUInt16();

                // Verify CRC
                byte[] messageWithoutCRC = new byte[payloadLength + 4];
                Array.Copy(buffer, 0, messageWithoutCRC, 0, payloadLength + 4);
                ushort calculatedCRC = CalculateCRC16(messageWithoutCRC);
                if (messageCRC != calculatedCRC)
                {
                    throw new Exception("CRC check failed");
                }

                // Parse message content
                Dictionary<object, object> parameters = ParseParameters(payload);

                var messageContent = new MessageContent
                {
                    MessageType = messageType,
                    OperationCode = operationCode,
                    Parameters = parameters,
                    MessageTypeName = GetMessageTypeName(messageType),
                    OperationName = GetOperationName(messageType, operationCode)
                };

                return messageContent;
            }
        }

        /// <summary>
        /// Parse parameters from payload
        /// </summary>
        private static Dictionary<object, object> ParseParameters(byte[] payload)
        {
            var parameters = new Dictionary<object, object>();

            using (MemoryStream stream = new MemoryStream(payload))
            using (BinaryReader reader = new BinaryReader(stream))
            {
                while (stream.Position < stream.Length)
                {
                    // Extract parameter header
                    byte paramCode = reader.ReadByte();
                    byte dataType = reader.ReadByte();

                    // Get parameter name if available
                    string paramName = GetParameterName(paramCode);

                    // Parse value based on data type
                    object value = ParseValue(reader, dataType, out int _);

                    // Store parameter using code and name if available
                    parameters[paramCode] = value;
                    if (paramName != null)
                    {
                        parameters[paramName] = value;
                    }
                }
            }

            return parameters;
        }

        /// <summary>
        /// Parse a value from the reader based on its data type
        /// </summary>
        private static object ParseValue(BinaryReader reader, byte dataType, out int bytesRead)
        {
            object value;
            long initialPosition = reader.BaseStream.Position;

            switch (dataType)
            {
                case Constants.DataType.BOOL:
                    value = reader.ReadByte() != 0;
                    break;

                case Constants.DataType.BYTE:
                    value = reader.ReadByte();
                    break;

                case Constants.DataType.SHORT:
                    value = reader.ReadInt16();
                    break;

                case Constants.DataType.USHORT:
                    value = reader.ReadUInt16();
                    break;

                case Constants.DataType.INT:
                    value = reader.ReadInt32();
                    break;

                case Constants.DataType.UINT:
                    value = reader.ReadUInt32();
                    break;

                case Constants.DataType.LONG:
                    value = reader.ReadInt64();
                    break;

                case Constants.DataType.FLOAT:
                    value = reader.ReadSingle();
                    break;

                case Constants.DataType.DOUBLE:
                    value = reader.ReadDouble();
                    break;

                case Constants.DataType.STRING:
                    ushort stringLength = reader.ReadUInt16();
                    byte[] stringBytes = reader.ReadBytes(stringLength);
                    value = Encoding.UTF8.GetString(stringBytes);
                    break;

                case Constants.DataType.VECTOR2:
                    value = new float[]
                    {
                        reader.ReadSingle(),
                        reader.ReadSingle()
                    };
                    break;

                case Constants.DataType.VECTOR3:
                    value = new float[]
                    {
                        reader.ReadSingle(),
                        reader.ReadSingle(),
                        reader.ReadSingle()
                    };
                    break;

                case Constants.DataType.QUATERNION:
                    value = new float[]
                    {
                        reader.ReadSingle(),
                        reader.ReadSingle(),
                        reader.ReadSingle(),
                        reader.ReadSingle()
                    };
                    break;

                case Constants.DataType.BYTE_ARRAY:
                    ushort arrayLength = reader.ReadUInt16();
                    value = reader.ReadBytes(arrayLength);
                    break;

                case Constants.DataType.DICTIONARY:
                    value = ParseDictionary(reader);
                    break;

                default:
                    throw new Exception($"Unknown data type: {dataType}");
            }

            bytesRead = (int)(reader.BaseStream.Position - initialPosition);
            return value;
        }

        /// <summary>
        /// Parse a dictionary value
        /// </summary>
        private static Dictionary<object, object> ParseDictionary(BinaryReader reader)
        {
            var dict = new Dictionary<object, object>();
            ushort pairCount = reader.ReadUInt16();

            for (int i = 0; i < pairCount; i++)
            {
                // Parse key
                byte keyType = reader.ReadByte();
                object key = ParseValue(reader, keyType, out int _);

                // Parse value
                byte valueType = reader.ReadByte();
                object value = ParseValue(reader, valueType, out int _);

                // Add to dictionary
                dict[key] = value;
            }

            return dict;
        }

        /// <summary>
        /// Calculate CRC-16 checksum
        /// </summary>
        private static ushort CalculateCRC16(byte[] buffer)
        {
            // CRC-16 implementation
            const ushort polynomial = 0xA001; // Standard CRC-16 polynomial
            ushort crc = 0xFFFF;

            foreach (byte b in buffer)
            {
                crc ^= b;
                for (int i = 0; i < 8; i++)
                {
                    if ((crc & 0x0001) != 0)
                    {
                        crc = (ushort)((crc >> 1) ^ polynomial);
                    }
                    else
                    {
                        crc = (ushort)(crc >> 1);
                    }
                }
            }

            return crc;
        }

        /// <summary>
        /// Get human-readable message type name
        /// </summary>
        private static string GetMessageTypeName(byte messageType)
        {
            var constants = typeof(Constants.MessageType)
                .GetFields(BindingFlags.Public | BindingFlags.Static | BindingFlags.FlattenHierarchy)
                .Where(fi => fi.IsLiteral && !fi.IsInitOnly && fi.FieldType == typeof(byte));

            foreach (var field in constants)
            {
                if ((byte)field.GetValue(null) == messageType)
                {
                    return field.Name;
                }
            }
            return "UNKNOWN";
        }

        /// <summary>
        /// Get human-readable operation name
        /// </summary>
        private static string GetOperationName(byte messageType, byte operationCode)
        {
            Type operationMapType = null;

            // Select the appropriate operation map based on message type
            switch (messageType)
            {
                case Constants.MessageType.SYSTEM:
                    operationMapType = typeof(Constants.OperationCode.SYSTEM);
                    break;
                case Constants.MessageType.ROOM:
                    operationMapType = typeof(Constants.OperationCode.ROOM);
                    break;
                case Constants.MessageType.EVENT:
                    operationMapType = typeof(Constants.OperationCode.EVENT);
                    break;
                default:
                    return "UNKNOWN";
            }

            var constants = operationMapType
                .GetFields(BindingFlags.Public | BindingFlags.Static | BindingFlags.FlattenHierarchy)
                .Where(fi => fi.IsLiteral && !fi.IsInitOnly && fi.FieldType == typeof(byte));

            foreach (var field in constants)
            {
                if ((byte)field.GetValue(null) == operationCode)
                {
                    return field.Name;
                }
            }

            return "UNKNOWN";
        }

        /// <summary>
        /// Get human-readable parameter name
        /// </summary>
        private static string GetParameterName(byte paramCode)
        {
            var constants = typeof(Constants.ParameterCode)
                .GetFields(BindingFlags.Public | BindingFlags.Static | BindingFlags.FlattenHierarchy)
                .Where(fi => fi.IsLiteral && !fi.IsInitOnly && fi.FieldType == typeof(byte));

            foreach (var field in constants)
            {
                if ((byte)field.GetValue(null) == paramCode)
                {
                    return field.Name;
                }
            }
            return null;
        }
    }

    /// <summary>
    /// Represents the content of an ARCHIVE message
    /// </summary>
    public class MessageContent
    {
        /// <summary>
        /// The message type code
        /// </summary>
        public byte MessageType { get; set; }

        /// <summary>
        /// The operation code
        /// </summary>
        public byte OperationCode { get; set; }

        /// <summary>
        /// The parameters dictionary
        /// </summary>
        public Dictionary<object, object> Parameters { get; set; }

        /// <summary>
        /// The human-readable message type name
        /// </summary>
        public string MessageTypeName { get; set; }

        /// <summary>
        /// The human-readable operation name
        /// </summary>
        public string OperationName { get; set; }
    }

    /// <summary>
    /// ARCHIVE connection helper class
    /// Provides utility methods for handling ARCHIVE protocol connections
    /// </summary>
    public class ArchiveConnection : IDisposable
    {
        private readonly ClientWebSocket _socket;
        private uint _sequenceNumber;
        private Dictionary<uint, PendingAck> _pendingAcks;
        private Dictionary<uint, MessageContent> _receivedMessages;
        private CancellationTokenSource _cancellationTokenSource;
        private Task _receiveTask;

        /// <summary>
        /// Delegate for message handling
        /// </summary>
        public delegate void MessageHandler(MessageContent message);

        /// <summary>
        /// Delegate for error handling
        /// </summary>
        public delegate void ErrorHandler(ErrorInfo error);

        /// <summary>
        /// Event fired when a message is received
        /// </summary>
        public event MessageHandler OnMessage;

        /// <summary>
        /// Event fired when an error occurs
        /// </summary>
        public event ErrorHandler OnError;

        /// <summary>
        /// Create a new connection handler
        /// </summary>
        /// <param name="socket">WebSocket instance</param>
        public ArchiveConnection(ClientWebSocket socket)
        {
            _socket = socket;
            _sequenceNumber = 0;
            _pendingAcks = new Dictionary<uint, PendingAck>();
            _receivedMessages = new Dictionary<uint, MessageContent>();
            _cancellationTokenSource = new CancellationTokenSource();

            // Set up event handlers
            SetupEventHandlers();
        }

        /// <summary>
        /// Set up socket event handlers
        /// </summary>
        private void SetupEventHandlers()
        {
            if (_socket == null) return;

            _receiveTask = Task.Run(async () => await ReceiveMessagesAsync());
        }

        /// <summary>
        /// Continuously receive messages from WebSocket
        /// </summary>
        private async Task ReceiveMessagesAsync()
        {
            var buffer = new byte[8192]; // 8KB buffer
            var receiveBuffer = new ArraySegment<byte>(buffer);

            try
            {
                while (!_cancellationTokenSource.Token.IsCancellationRequested)
                {
                    WebSocketReceiveResult result;
                    using (var ms = new MemoryStream())
                    {
                        do
                        {
                            result = await _socket.ReceiveAsync(receiveBuffer, _cancellationTokenSource.Token);
                            if (result.Count > 0)
                            {
                                ms.Write(buffer, 0, result.Count);
                            }
                        } while (!result.EndOfMessage);

                        if (result.MessageType == WebSocketMessageType.Close)
                        {
                            break;
                        }

                        if (result.MessageType == WebSocketMessageType.Binary)
                        {
                            try
                            {
                                var messageData = ms.ToArray();
                                var message = ArchiveParser.Parse(messageData);
                                HandleMessage(message);
                            }
                            catch (Exception ex)
                            {
                                OnError?.Invoke(new ErrorInfo
                                {
                                    Type = "PARSE_ERROR",
                                    Message = $"Error parsing ARCHIVE message: {ex.Message}"
                                });
                            }
                        }
                    }
                }
            }
            catch (Exception ex) when (ex is OperationCanceledException || ex is WebSocketException)
            {
                // Graceful shutdown or connection closed
            }
            catch (Exception ex)
            {
                OnError?.Invoke(new ErrorInfo
                {
                    Type = "CONNECTION_ERROR",
                    Message = $"WebSocket error: {ex.Message}"
                });
            }
        }

        /// <summary>
        /// Handle received messages
        /// </summary>
        private void HandleMessage(MessageContent message)
        {
            // Check if this is an ACK message
            if (message.MessageType == Constants.MessageType.ACK)
            {
                HandleAcknowledgement(message);
                return;
            }

            // For RELIABLE messages, send an acknowledgement
            if (message.MessageType == Constants.MessageType.RELIABLE &&
                message.Parameters != null &&
                message.Parameters.ContainsKey(Constants.ParameterCode.SEQUENCE))
            {
                SendAcknowledgement((uint)message.Parameters[Constants.ParameterCode.SEQUENCE]);
            }

            // Emit a message event for application to handle
            OnMessage?.Invoke(message);
        }

        /// <summary>
        /// Handle acknowledgement messages
        /// </summary>
        private void HandleAcknowledgement(MessageContent message)
        {
            if (message.Parameters != null && message.Parameters.ContainsKey(Constants.ParameterCode.SEQUENCE))
            {
                uint seqNum = (uint)message.Parameters[Constants.ParameterCode.SEQUENCE];

                // Clear any pending retransmission
                if (_pendingAcks.TryGetValue(seqNum, out PendingAck pendingAck))
                {
                    pendingAck.CancellationTokenSource.Cancel();
                    pendingAck.CancellationTokenSource.Dispose();
                    _pendingAcks.Remove(seqNum);
                }
            }
        }

        /// <summary>
        /// Send an acknowledgement for a received message
        /// </summary>
        private async Task SendAcknowledgementAsync(uint sequenceNumber)
        {
            var writer = new ArchiveWriter(Constants.MessageType.ACK, 0x01);
            writer.AddParameter(Constants.ParameterCode.SEQUENCE, Constants.DataType.UINT, sequenceNumber);
            byte[] ackMessage = writer.Encode();

            await SendRawAsync(ackMessage);
        }

        /// <summary>
        /// Send an acknowledgement for a received message (synchronous wrapper)
        /// </summary>
        private void SendAcknowledgement(uint sequenceNumber)
        {
            Task.Run(async () => await SendAcknowledgementAsync(sequenceNumber)).Wait();
        }

        /// <summary>
        /// Send a message with retransmission for reliable messages
        /// </summary>
        /// <param name="messageBuffer">The encoded message</param>
        /// <param name="options">Options for sending</param>
        /// <returns>Task representing the asynchronous operation</returns>
        public async Task SendAsync(byte[] messageBuffer, SendOptions options = null)
        {
            options = options ?? new SendOptions();

            await SendRawAsync(messageBuffer);

            // Check if this is a RELIABLE message that needs acknowledgement
            try
            {
                var message = ArchiveParser.Parse(messageBuffer);

                if (message.MessageType == Constants.MessageType.RELIABLE &&
                    message.Parameters != null &&
                    message.Parameters.ContainsKey(Constants.ParameterCode.SEQUENCE))
                {
                    uint seqNum = (uint)message.Parameters[Constants.ParameterCode.SEQUENCE];

                    // Set up retransmission
                    var cts = new CancellationTokenSource();
                    var pendingAck = new PendingAck
                    {
                        Message = messageBuffer,
                        CancellationTokenSource = cts
                    };

                    _pendingAcks[seqNum] = pendingAck;

                    // Start retransmission task
                    _ = Task.Run(async () =>
                    {
                        await RetransmitAsync(messageBuffer, seqNum, 0, options.Timeout, options.MaxRetries, cts.Token);
                    });
                }
            }
            catch (Exception ex)
            {
                OnError?.Invoke(new ErrorInfo
                {
                    Type = "SEND_ERROR",
                    Message = $"Error processing outgoing message: {ex.Message}"
                });
            }
        }

        /// <summary>
        /// Retransmit a message if no acknowledgement received
        /// </summary>
        private async Task RetransmitAsync(byte[] messageBuffer, uint sequenceNumber, int retries,
            int timeout, int maxRetries, CancellationToken cancellationToken)
        {
            try
            {
                // Wait for the timeout period
                await Task.Delay(timeout, cancellationToken);

                // Check if we should stop retrying
                if (cancellationToken.IsCancellationRequested || retries >= maxRetries || !_pendingAcks.ContainsKey(sequenceNumber))
                {
                    if (_pendingAcks.ContainsKey(sequenceNumber))
                    {
                        _pendingAcks.Remove(sequenceNumber);
                    }

                    if (retries >= maxRetries)
                    {
                        OnError?.Invoke(new ErrorInfo
                        {
                            Type = "TRANSMISSION_FAILED",
                            SequenceNumber = sequenceNumber,
                            Message = "Failed to transmit message after maximum retries"
                        });
                    }
                    return;
                }

                // Resend the message
                await SendRawAsync(messageBuffer);

                // Set up next retry
                await RetransmitAsync(messageBuffer, sequenceNumber, retries + 1, timeout, maxRetries, cancellationToken);
            }
            catch (OperationCanceledException)
            {
                // Acknowledgement received, cancellation is expected
            }
            catch (Exception ex)
            {
                OnError?.Invoke(new ErrorInfo
                {
                    Type = "RETRANSMIT_ERROR",
                    SequenceNumber = sequenceNumber,
                    Message = $"Error during retransmission: {ex.Message}"
                });
            }
        }

        /// <summary>
        /// Low-level send method
        /// </summary>
        private async Task SendRawAsync(byte[] messageBuffer)
        {
            if (_socket != null && _socket.State == WebSocketState.Open)
            {
                await _socket.SendAsync(new ArraySegment<byte>(messageBuffer),
                    WebSocketMessageType.Binary, true, _cancellationTokenSource.Token);
            }
        }

        /// <summary>
        /// Get the next sequence number for reliable messaging
        /// </summary>
        /// <returns>Next sequence number</returns>
        public uint GetNextSequence()
        {
            _sequenceNumber = (_sequenceNumber + 1) % 0xFFFFFFFF; // 32-bit wraparound
            return _sequenceNumber;
        }

        /// <summary>
        /// Close the connection and clean up resources
        /// </summary>
        public async Task CloseAsync()
        {
            // Cancel all pending tasks
            _cancellationTokenSource.Cancel();

            // Clear all pending acknowledgements
            foreach (var pending in _pendingAcks.Values)
            {
                pending.CancellationTokenSource.Cancel();
                pending.CancellationTokenSource.Dispose();
            }
            _pendingAcks.Clear();

            // Close the socket if it's open
            if (_socket != null && _socket.State == WebSocketState.Open)
            {
                await _socket.CloseAsync(WebSocketCloseStatus.NormalClosure, "Connection closed by client",
                    CancellationToken.None);
            }
        }

        /// <summary>
        /// Implements IDisposable
        /// </summary>
        public void Dispose()
        {
            // Cancel all pending tasks
            _cancellationTokenSource.Cancel();
            _cancellationTokenSource.Dispose();

            // Clear all pending acknowledgements
            foreach (var pending in _pendingAcks.Values)
            {
                pending.CancellationTokenSource.Cancel();
                pending.CancellationTokenSource.Dispose();
            }
            _pendingAcks.Clear();

            // Close the socket if it's open
            if (_socket != null && _socket.State == WebSocketState.Open)
            {
                _socket.CloseAsync(WebSocketCloseStatus.NormalClosure, "Connection disposed",
                    CancellationToken.None).Wait();
            }
        }
    }

    /// <summary>
    /// Options for sending messages
    /// </summary>
    public class SendOptions
    {
        /// <summary>
        /// Timeout for retransmission in ms (default: 3000)
        /// </summary>
        public int Timeout { get; set; } = 3000;

        /// <summary>
        /// Maximum number of retries (default: 5)
        /// </summary>
        public int MaxRetries { get; set; } = 5;
    }

    /// <summary>
    /// Information about pending acknowledgements
    /// </summary>
    internal class PendingAck
    {
        /// <summary>
        /// The message buffer
        /// </summary>
        public byte[] Message { get; set; }

        /// <summary>
        /// Cancellation token source for timeout
        /// </summary>
        public CancellationTokenSource CancellationTokenSource { get; set; }
    }

    /// <summary>
    /// Information about errors
    /// </summary>
    public class ErrorInfo
    {
        /// <summary>
        /// The type of error
        /// </summary>
        public string Type { get; set; }

        /// <summary>
        /// The sequence number (if applicable)
        /// </summary>
        public uint? SequenceNumber { get; set; }

        /// <summary>
        /// The error message
        /// </summary>
        public string Message { get; set; }
    }
}