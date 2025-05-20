using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Archive3Unity3D.Constants
{
    /// <summary>
    /// Constants for message types
    /// </summary>
    public static class MessageType
    {
        public const byte SYSTEM = 0x01;
        public const byte RELIABLE = 0x02;
        public const byte UNRELIABLE = 0x03;
        public const byte FRAGMENT = 0x04;
        public const byte ACK = 0x05;
        public const byte PING = 0x06;
        public const byte ROOM = 0x07;
        public const byte EVENT = 0x08;
    }
}
