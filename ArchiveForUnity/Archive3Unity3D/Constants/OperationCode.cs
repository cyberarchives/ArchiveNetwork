using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Archive3Unity3D.Constants
{
    public static class OperationCode
    {
        public static class SYSTEM
        {
            public const byte CONNECT = 0x01;
            public const byte DISCONNECT = 0x02;
            public const byte AUTH = 0x03;
            public const byte HEARTBEAT = 0x04;
        }

        public static class ROOM
        {
            public const byte CREATE = 0x01;
            public const byte JOIN = 0x02;
            public const byte LEAVE = 0x03;
            public const byte LIST = 0x04;
            public const byte PROPERTIES = 0x05;
        }

        public static class EVENT
        {
            public const byte RAISE = 0x01;
            public const byte STATE = 0x02;
            public const byte SNAPSHOT = 0x03;
        }
    }
}
