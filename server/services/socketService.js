const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

let io = null;

/**
 * Parse cookies from raw cookie header string
 */
function parseCookies(cookieHeader) {
  const cookies = {};
  if (!cookieHeader) return cookies;
  const pairs = cookieHeader.split(';');
  for (const pair of pairs) {
    const [key, ...values] = pair.trim().split('=');
    if (key) {
      cookies[key] = decodeURIComponent(values.join('='));
    }
  }
  return cookies;
}

/**
 * Initialize Socket.IO with HTTP server
 */
function init(httpServer, allowedOrigins = []) {
  if (io) return io;

  io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
        if (process.env.NODE_ENV !== 'production') {
          const isLan = /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+)(:\d+)?$/.test(origin);
          if (isLan) return callback(null, true);
        }
        return callback(null, false);
      },
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  // Socket Authentication Middleware
  io.use((socket, next) => {
    try {
      let token = socket.handshake.auth?.token;

      if (!token && socket.handshake.headers?.authorization) {
        const parts = socket.handshake.headers.authorization.split(' ');
        if (parts.length === 2 && /^Bearer$/i.test(parts[0])) {
          token = parts[1];
        }
      }

      if (!token && socket.handshake.headers?.cookie) {
        const cookies = parseCookies(socket.handshake.headers.cookie);
        token = cookies.accessToken;
      }

      if (token) {
        try {
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          socket.user = {
            id: decoded.id || decoded.user_id,
            user_id: decoded.id || decoded.user_id,
            role: decoded.role || 'customer',
            roles: decoded.roles || [decoded.role || 'customer'],
          };
        } catch (tokenErr) {
          // Token is invalid/expired - continue as guest
          socket.user = null;
        }
      } else {
        socket.user = null;
      }

      return next();
    } catch (err) {
      return next(err);
    }
  });

  io.on('connection', (socket) => {
    if (socket.user?.id) {
      const userRoom = `user:${socket.user.id}`;
      socket.join(userRoom);

      if (['admin', 'staff', 'super_admin'].includes(socket.user.role)) {
        socket.join('staff_channel');
        socket.join('admin_channel');
      }

      if (process.env.NODE_ENV !== 'production') {
        console.log(`[Socket.IO] Authenticated connection: ${socket.id} (User: ${socket.user.id}, Role: ${socket.user.role})`);
      }
    } else {
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[Socket.IO] Anonymous connection: ${socket.id}`);
      }
    }

    socket.on('disconnect', (reason) => {
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[Socket.IO] Client disconnected: ${socket.id} (${reason})`);
      }
    });
  });

  return io;
}

/**
 * Get Socket.IO instance
 */
function getIO() {
  return io;
}

/**
 * Emit an event to a specific user by their user_id
 */
function emitToUser(userId, event, payload) {
  if (!io || !userId) return false;
  io.to(`user:${userId}`).emit(event, payload);
  return true;
}

/**
 * Emit an event to all staff / admin members
 */
function emitToStaff(event, payload) {
  if (!io) return false;
  io.to('staff_channel').emit(event, payload);
  return true;
}

/**
 * Emit a broadcast event to all connected clients
 */
function emitBroadcast(event, payload) {
  if (!io) return false;
  io.emit(event, payload);
  return true;
}

/**
 * Emit an event to a user and all staff/admin members without duplicate delivery.
 * Sockets in both rooms will receive the event exactly once.
 */
function emitToUserAndStaff(userId, event, payload) {
  if (!io) return false;
  const targetRooms = ['staff_channel'];
  if (userId) {
    targetRooms.push(`user:${userId}`);
  }
  io.to(targetRooms).emit(event, payload);
  return true;
}

module.exports = {
  init,
  getIO,
  emitToUser,
  emitToStaff,
  emitToUserAndStaff,
  emitBroadcast,
};
