using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Archive3Unity3D.Realtime
{
    /// <summary>
    /// ARCHIVE Message Writer class
    /// </summary>
    public class ArchiveWriter
    {
        private byte _messageType;
        private byte _operationCode;
        private MemoryStream _payload;

        /// <summary>
        /// Create a new ARCHIVE message
        /// </summary>
        /// <param name="messageType">The message type (from MessageType enum)</param>
        /// <param name="operationCode">The operation code</param>
        public ArchiveWriter(byte messageType, byte operationCode)
        {
            _messageType = messageType;
            _operationCode = operationCode;
            _payload = new MemoryStream();
        }

        /// <summary>
        /// Add a parameter to the message
        /// </summary>
        /// <param name="paramCode">The parameter code (from ParameterCode enum)</param>
        /// <param name="dataType">The data type (from DataType enum)</param>
        /// <param name="value">The parameter value</param>
        /// <returns>The message writer instance for chaining</returns>
        public ArchiveWriter AddParameter(byte paramCode, byte dataType, object value)
        {
            using (MemoryStream paramStream = new MemoryStream())
            using (BinaryWriter writer = new BinaryWriter(paramStream))
            {
                // Parameter code (1 byte) + Data type (1 byte)
                writer.Write(paramCode);
                writer.Write(dataType);

                // Encode the value based on its data type
                switch (dataType)
                {
                    case Constants.DataType.BOOL:
                        writer.Write((bool)value ? (byte)1 : (byte)0);
                        break;

                    case Constants.DataType.BYTE:
                        writer.Write((byte)value);
                        break;

                    case Constants.DataType.SHORT:
                        writer.Write((short)value);
                        break;

                    case Constants.DataType.USHORT:
                        writer.Write((ushort)value);
                        break;

                    case Constants.DataType.INT:
                        writer.Write((int)value);
                        break;

                    case Constants.DataType.UINT:
                        writer.Write((uint)value);
                        break;

                    case Constants.DataType.LONG:
                        writer.Write((long)value);
                        break;

                    case Constants.DataType.FLOAT:
                        writer.Write((float)value);
                        break;

                    case Constants.DataType.DOUBLE:
                        writer.Write((double)value);
                        break;

                    case Constants.DataType.STRING:
                        byte[] stringBytes = Encoding.UTF8.GetBytes((string)value);
                        writer.Write((ushort)stringBytes.Length);
                        writer.Write(stringBytes);
                        break;

                    case Constants.DataType.VECTOR2:
                        float[] vector2 = (float[])value;
                        writer.Write(vector2[0]);
                        writer.Write(vector2[1]);
                        break;

                    case Constants.DataType.VECTOR3:
                        float[] vector3 = (float[])value;
                        writer.Write(vector3[0]);
                        writer.Write(vector3[1]);
                        writer.Write(vector3[2]);
                        break;

                    case Constants.DataType.QUATERNION:
                        float[] quaternion = (float[])value;
                        writer.Write(quaternion[0]);
                        writer.Write(quaternion[1]);
                        writer.Write(quaternion[2]);
                        writer.Write(quaternion[3]);
                        break;

                    case Constants.DataType.BYTE_ARRAY:
                        byte[] byteArray = (byte[])value;
                        writer.Write((ushort)byteArray.Length);
                        writer.Write(byteArray);
                        break;

                    case Constants.DataType.DICTIONARY:
                        IDictionary<string, object> dictionary = (IDictionary<string, object>)value;
                        writer.Write((ushort)dictionary.Count);

                        foreach (var pair in dictionary)
                        {
                            // Keys are always strings in this implementation
                            writer.Write((byte)Constants.DataType.STRING);
                            byte[] keyBytes = Encoding.UTF8.GetBytes(pair.Key);
                            writer.Write((ushort)keyBytes.Length);
                            writer.Write(keyBytes);

                            // Encode value based on its type
                            EncodeDictionaryValue(writer, pair.Value);
                        }
                        break;

                    default:
                        throw new ArgumentException($"Unsupported data type: {dataType}");
                }

                // Add to the payload
                byte[] paramBytes = paramStream.ToArray();
                _payload.Write(paramBytes, 0, paramBytes.Length);
            }

            return this;
        }

        /// <summary>
        /// Helper method to encode dictionary values
        /// </summary>
        private void EncodeDictionaryValue(BinaryWriter writer, object value)
        {
            if (value is bool boolValue)
            {
                writer.Write((byte)Constants.DataType.BOOL);
                writer.Write(boolValue ? (byte)1 : (byte)0);
            }
            else if (value is byte byteValue)
            {
                writer.Write((byte)Constants.DataType.BYTE);
                writer.Write(byteValue);
            }
            else if (value is short shortValue)
            {
                writer.Write((byte)Constants.DataType.SHORT);
                writer.Write(shortValue);
            }
            else if (value is ushort ushortValue)
            {
                writer.Write((byte)Constants.DataType.USHORT);
                writer.Write(ushortValue);
            }
            else if (value is int intValue)
            {
                writer.Write((byte)Constants.DataType.INT);
                writer.Write(intValue);
            }
            else if (value is uint uintValue)
            {
                writer.Write((byte)Constants.DataType.UINT);
                writer.Write(uintValue);
            }
            else if (value is long longValue)
            {
                writer.Write((byte)Constants.DataType.LONG);
                writer.Write(longValue);
            }
            else if (value is float floatValue)
            {
                writer.Write((byte)Constants.DataType.FLOAT);
                writer.Write(floatValue);
            }
            else if (value is double doubleValue)
            {
                writer.Write((byte)Constants.DataType.DOUBLE);
                writer.Write(doubleValue);
            }
            else if (value is string stringValue)
            {
                writer.Write((byte)Constants.DataType.STRING);
                byte[] stringBytes = Encoding.UTF8.GetBytes(stringValue);
                writer.Write((ushort)stringBytes.Length);
                writer.Write(stringBytes);
            }
            else if (value is float[] arrayValue)
            {
                if (arrayValue.Length == 2)
                {
                    writer.Write((byte)Constants.DataType.VECTOR2);
                    writer.Write(arrayValue[0]);
                    writer.Write(arrayValue[1]);
                }
                else if (arrayValue.Length == 3)
                {
                    writer.Write((byte)Constants.DataType.VECTOR3);
                    writer.Write(arrayValue[0]);
                    writer.Write(arrayValue[1]);
                    writer.Write(arrayValue[2]);
                }
                else if (arrayValue.Length == 4)
                {
                    writer.Write((byte)Constants.DataType.QUATERNION);
                    writer.Write(arrayValue[0]);
                    writer.Write(arrayValue[1]);
                    writer.Write(arrayValue[2]);
                    writer.Write(arrayValue[3]);
                }
                else
                {
                    // Default to byte array (assuming conversion is valid)
                    writer.Write((byte)Constants.DataType.BYTE_ARRAY);
                    byte[] byteArray = Array.ConvertAll(arrayValue, x => (byte)x);
                    writer.Write((ushort)byteArray.Length);
                    writer.Write(byteArray);
                }
            }
            else if (value is byte[] byteArrayValue)
            {
                writer.Write((byte)Constants.DataType.BYTE_ARRAY);
                writer.Write((ushort)byteArrayValue.Length);
                writer.Write(byteArrayValue);
            }
            else if (value is IDictionary<string, object> dictValue)
            {
                writer.Write((byte)Constants.DataType.DICTIONARY);
                writer.Write((ushort)dictValue.Count);

                foreach (var pair in dictValue)
                {
                    // Keys are always strings
                    writer.Write((byte)Constants.DataType.STRING);
                    byte[] keyBytes = Encoding.UTF8.GetBytes(pair.Key);
                    writer.Write((ushort)keyBytes.Length);
                    writer.Write(keyBytes);

                    // Recursively encode nested value
                    EncodeDictionaryValue(writer, pair.Value);
                }
            }
            else
            {
                throw new ArgumentException($"Unsupported value type: {value?.GetType().Name ?? "null"}");
            }
        }

        /// <summary>
        /// Calculate CRC-16 checksum
        /// </summary>
        private ushort CalculateCRC16(byte[] buffer)
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
        /// Finalize and encode the message to a binary buffer
        /// </summary>
        /// <returns>The encoded message as a byte array</returns>
        public byte[] Encode()
        {
            byte[] payloadBytes = _payload.ToArray();

            using (MemoryStream messageStream = new MemoryStream())
            using (BinaryWriter writer = new BinaryWriter(messageStream))
            {
                // Create header (4 bytes)
                writer.Write(_messageType);
                writer.Write(_operationCode);
                writer.Write((ushort)payloadBytes.Length);

                // Add payload
                writer.Write(payloadBytes);

                // Get the message without CRC
                byte[] messageWithoutCRC = messageStream.ToArray();

                // Calculate CRC (2 bytes)
                ushort crc = CalculateCRC16(messageWithoutCRC);

                // Add CRC to the end
                writer.Write(crc);

                return messageStream.ToArray();
            }
        }
    }
}
