const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

let io = null;

/**
 * Parse cookies from raw Cookie header.
 */
function parseCookies(cookieHeader) {
  const cookies = {};

  if (!cookieHeader) {
    return cookies;
  }

  const pairs = cookieHeader.split(';');

  for (const pair of pairs) {
    const [key, ...values] = pair.trim().split('=');

    if (key) {
      try {
        cookies[key] = decodeURIComponent(values.join('='));
      } catch {
        cookies[key] = values.join('=');
      }
    }
  }

  return cookies;
}

/**
 * Get authentication token from Socket.IO handshake.
 *
 * Priority:
 * 1. socket.handshake.auth.token
 * 2. Authorization: Bearer <token>
 * 3. accessToken cookie
 */
function getSocketToken(socket) {
  // 1. Socket.IO auth payload
  let token = socket.handshake.auth?.token;

  if (token) {
    return token;
  }

  // 2. Authorization header
  const authorization = socket.handshake.headers?.authorization;

  if (authorization) {
    const parts = authorization.trim().split(/\s+/);

    if (
      parts.length === 2 &&
      /^Bearer$/i.test(parts[0])
    ) {
      return parts[1];
    }
  }

  // 3. HTTP-only cookie
  const cookieHeader = socket.handshake.headers?.cookie;

  if (cookieHeader) {
    const cookies = parseCookies(cookieHeader);

    if (cookies.accessToken) {
      return cookies.accessToken;
    }
  }

  return null;
}

/**
 * Initialize Socket.IO with the HTTP server.
 */
function init(httpServer, allowedOrigins = []) {
  if (io) {
    return io;
  }

  io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        // Allow requests without an Origin header.
        // This can occur with server-to-server requests,
        // health checks, etc.
        if (!origin) {
          return callback(null, true);
        }

        // Production / configured origins
        if (allowedOrigins.includes(origin)) {
          return callback(null, true);
        }

        // Development LAN support
        if (process.env.NODE_ENV !== 'production') {
          const isLan = /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+)(:\d+)?$/.test(
            origin
          );

          if (isLan) {
            return callback(null, true);
          }
        }

        return callback(
          new Error(`Origin ${origin} not allowed by Socket.IO CORS`)
        );
      },

      credentials: true,
    },

    // Allow polling initially and upgrade to WebSocket.
    // This works well behind Coolify's reverse proxy.
    transports: ['polling', 'websocket'],
  });

  /**
   * Socket authentication middleware.
   */
  io.use((socket, next) => {
    try {
      const token = getSocketToken(socket);

      // No credentials = anonymous/guest connection.
      if (!token) {
        socket.user = null;
        return next();
      }

      let decoded;

      try {
        decoded = jwt.verify(
          token,
          process.env.JWT_SECRET
        );
      } catch (error) {
        // A token was supplied but is invalid/expired.
        return next(
          new Error('Authentication failed')
        );
      }

      const userId =
        decoded.id ||
        decoded.user_id ||
        decoded.userId;

      if (!userId) {
        return next(
          new Error('Invalid authentication token')
        );
      }

      /**
       * IMPORTANT:
       *
       * The token has been cryptographically verified.
       *
       * Roles are read from the token here for compatibility
       * with the existing CosmosCraft authentication system.
       *
       * If your RBAC database is authoritative, you can
       * replace this section with a database role lookup.
       */
      const role =
        decoded.role || 'customer';

      const roles = Array.isArray(decoded.roles)
        ? decoded.roles
        : [role];

      socket.user = {
        id: userId,
        user_id: userId,
        role,
        roles,
      };

      return next();
    } catch (error) {
      console.error(
        '[Socket.IO] Authentication error:',
        error
      );

      return next(
        new Error('Socket authentication failed')
      );
    }
  });

  /**
   * New Socket.IO connection.
   */
  io.on('connection', (socket) => {
    const user = socket.user;

    if (user?.id) {
      /**
       * Private user room.
       */
      const userRoom = `user:${user.id}`;

      socket.join(userRoom);

      /**
       * Staff channel.
       *
       * Staff, admins and super admins can receive
       * staff-level events.
       */
      const staffRoles = [
        'staff',
        'admin',
        'super_admin',
      ];

      if (staffRoles.includes(user.role)) {
        socket.join('staff_channel');
      }

      /**
       * Admin channel.
       *
       * Only admin and super_admin should receive
       * admin-level events.
       */
      const adminRoles = [
        'admin',
        'super_admin',
      ];

      if (adminRoles.includes(user.role)) {
        socket.join('admin_channel');
      }

      if (process.env.NODE_ENV !== 'production') {
        console.log(
          `[Socket.IO] Authenticated connection: ${socket.id} ` +
          `(User: ${user.id}, Role: ${user.role})`
        );
      }
    } else {
      /**
       * Anonymous/guest connection.
       */
      if (process.env.NODE_ENV !== 'production') {
        console.log(
          `[Socket.IO] Anonymous connection: ${socket.id}`
        );
      }
    }

    /**
     * Disconnect handler.
     */
    socket.on('disconnect', (reason) => {
      if (process.env.NODE_ENV !== 'production') {
        console.log(
          `[Socket.IO] Client disconnected: ` +
          `${socket.id} (${reason})`
        );
      }
    });
  });

  return io;
}

/**
 * Get Socket.IO instance.
 */
function getIO() {
  return io;
}

/**
 * Emit an event to a specific user.
 */
function emitToUser(userId, event, payload) {
  if (!io || !userId) {
    return false;
  }

  io.to(`user:${userId}`).emit(
    event,
    payload
  );

  return true;
}

/**
 * Emit an event to all staff members.
 *
 * Includes:
 * - staff
 * - admin
 * - super_admin
 */
function emitToStaff(event, payload) {
  if (!io) {
    return false;
  }

  io.to('staff_channel').emit(
    event,
    payload
  );

  return true;
}

/**
 * Emit an event to administrators only.
 *
 * Includes:
 * - admin
 * - super_admin
 */
function emitToAdmins(event, payload) {
  if (!io) {
    return false;
  }

  io.to('admin_channel').emit(
    event,
    payload
  );

  return true;
}

/**
 * Broadcast an event to every connected client.
 */
function emitBroadcast(event, payload) {
  if (!io) {
    return false;
  }

  io.emit(event, payload);

  return true;
}

/**
 * Emit an event to:
 *
 * - the specific user
 * - staff members
 *
 * Socket.IO automatically deduplicates sockets
 * that belong to both rooms.
 */
function emitToUserAndStaff(
  userId,
  event,
  payload
) {
  if (!io) {
    return false;
  }

  const targetRooms = ['staff_channel'];

  if (userId) {
    targetRooms.push(`user:${userId}`);
  }

  io.to(targetRooms).emit(
    event,
    payload
  );

  return true;
}

/**
 * Emit an event to:
 *
 * - the specific user
 * - administrators
 *
 * Useful for admin-related user/order/payment events.
 */
function emitToUserAndAdmins(
  userId,
  event,
  payload
) {
  if (!io) {
    return false;
  }

  const targetRooms = ['admin_channel'];

  if (userId) {
    targetRooms.push(`user:${userId}`);
  }

  io.to(targetRooms).emit(
    event,
    payload
  );

  return true;
}

module.exports = {
  init,
  getIO,
  emitToUser,
  emitToStaff,
  emitToAdmins,
  emitToUserAndStaff,
  emitToUserAndAdmins,
  emitBroadcast,
};