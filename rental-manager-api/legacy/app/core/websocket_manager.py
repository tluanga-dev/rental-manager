"""
WebSocket Connection Manager for Real-Time Updates

Handles WebSocket connections, room-based subscriptions, and event broadcasting
for real-time rental updates.
"""

import asyncio
import json
import logging
from typing import Dict, Set, Optional, Any, List
from datetime import datetime
from fastapi import WebSocket, WebSocketDisconnect
from enum import Enum
import uuid

logger = logging.getLogger(__name__)


class EventType(str, Enum):
    """WebSocket event types"""
    # Connection events
    CONNECTED = "connected"
    DISCONNECTED = "disconnected"
    ERROR = "error"
    HEARTBEAT = "heartbeat"
    
    # Subscription events
    SUBSCRIBE = "subscribe"
    UNSUBSCRIBE = "unsubscribe"
    
    # Rental events
    RENTAL_NEW = "rental_new"
    RENTAL_UPDATE = "rental_update"
    RENTAL_STATUS_CHANGED = "rental_status_changed"
    RENTAL_RETURNED = "rental_returned"
    RENTAL_EXTENDED = "rental_extended"
    RENTAL_PAYMENT = "rental_payment"
    
    # Batch updates
    RENTALS_BATCH = "rentals_batch"
    STATS_UPDATE = "stats_update"


class ConnectionState:
    """Represents a WebSocket connection state"""
    
    def __init__(self, websocket: WebSocket, user_id: str, connection_id: str):
        self.websocket = websocket
        self.user_id = user_id
        self.connection_id = connection_id
        self.connected_at = datetime.utcnow()
        self.last_heartbeat = datetime.utcnow()
        self.rooms: Set[str] = set()
        self.filters: Dict[str, Any] = {}
        
    def __repr__(self):
        return f"<Connection {self.connection_id} user={self.user_id} rooms={self.rooms}>"


class WebSocketManager:
    """
    Manages WebSocket connections and message broadcasting
    
    Features:
    - Connection pooling
    - Room-based subscriptions
    - Event broadcasting
    - Heartbeat monitoring
    - Automatic cleanup
    """
    
    def __init__(self):
        # Connection storage
        self._connections: Dict[str, ConnectionState] = {}
        self._user_connections: Dict[str, Set[str]] = {}
        self._room_connections: Dict[str, Set[str]] = {}
        
        # Configuration
        self.heartbeat_interval = 30  # seconds
        self.heartbeat_timeout = 90  # seconds
        self.max_connections_per_user = 5
        
        # Statistics
        self.stats = {
            "total_connections": 0,
            "messages_sent": 0,
            "messages_received": 0,
            "errors": 0
        }
        
        # Background tasks
        self._heartbeat_task: Optional[asyncio.Task] = None
        
    async def start(self):
        """Start background tasks"""
        if not self._heartbeat_task:
            self._heartbeat_task = asyncio.create_task(self._heartbeat_monitor())
            logger.info("WebSocket manager started")
    
    async def stop(self):
        """Stop background tasks and close all connections"""
        if self._heartbeat_task:
            self._heartbeat_task.cancel()
            try:
                await self._heartbeat_task
            except asyncio.CancelledError:
                pass
        
        # Close all connections
        for connection_id in list(self._connections.keys()):
            await self.disconnect(connection_id)
        
        logger.info("WebSocket manager stopped")
    
    async def connect(
        self, 
        websocket: WebSocket, 
        user_id: str,
        location_id: Optional[str] = None
    ) -> str:
        """
        Accept a new WebSocket connection
        
        Args:
            websocket: The WebSocket connection
            user_id: ID of the authenticated user
            location_id: Optional location ID for automatic room subscription
            
        Returns:
            Connection ID
        """
        await websocket.accept()
        
        # Check connection limit
        user_connections = self._user_connections.get(user_id, set())
        if len(user_connections) >= self.max_connections_per_user:
            await websocket.send_json({
                "type": EventType.ERROR,
                "message": f"Maximum connections ({self.max_connections_per_user}) exceeded"
            })
            await websocket.close(code=1008, reason="Connection limit exceeded")
            raise ValueError("Connection limit exceeded")
        
        # Create connection
        connection_id = str(uuid.uuid4())
        connection = ConnectionState(websocket, user_id, connection_id)
        
        # Store connection
        self._connections[connection_id] = connection
        
        # Track user connections
        if user_id not in self._user_connections:
            self._user_connections[user_id] = set()
        self._user_connections[user_id].add(connection_id)
        
        # Auto-subscribe to location room if provided
        if location_id:
            await self.subscribe_to_room(connection_id, f"location:{location_id}")
        
        # Send welcome message
        await self._send_to_connection(connection_id, {
            "type": EventType.CONNECTED,
            "connection_id": connection_id,
            "timestamp": datetime.utcnow().isoformat(),
            "heartbeat_interval": self.heartbeat_interval
        })
        
        self.stats["total_connections"] += 1
        logger.info(f"WebSocket connected: {connection_id} (user: {user_id})")
        
        return connection_id
    
    async def disconnect(self, connection_id: str):
        """
        Disconnect a WebSocket connection
        
        Args:
            connection_id: ID of the connection to disconnect
        """
        if connection_id not in self._connections:
            return
        
        connection = self._connections[connection_id]
        
        # Remove from rooms
        for room in connection.rooms:
            if room in self._room_connections:
                self._room_connections[room].discard(connection_id)
                if not self._room_connections[room]:
                    del self._room_connections[room]
        
        # Remove from user connections
        if connection.user_id in self._user_connections:
            self._user_connections[connection.user_id].discard(connection_id)
            if not self._user_connections[connection.user_id]:
                del self._user_connections[connection.user_id]
        
        # Close WebSocket
        try:
            await connection.websocket.close()
        except Exception as e:
            logger.error(f"Error closing WebSocket {connection_id}: {e}")
        
        # Remove connection
        del self._connections[connection_id]
        
        logger.info(f"WebSocket disconnected: {connection_id}")
    
    async def subscribe_to_room(self, connection_id: str, room: str):
        """
        Subscribe a connection to a room
        
        Args:
            connection_id: ID of the connection
            room: Room name to subscribe to
        """
        if connection_id not in self._connections:
            return
        
        connection = self._connections[connection_id]
        connection.rooms.add(room)
        
        if room not in self._room_connections:
            self._room_connections[room] = set()
        self._room_connections[room].add(connection_id)
        
        logger.debug(f"Connection {connection_id} subscribed to room {room}")
    
    async def unsubscribe_from_room(self, connection_id: str, room: str):
        """
        Unsubscribe a connection from a room
        
        Args:
            connection_id: ID of the connection
            room: Room name to unsubscribe from
        """
        if connection_id not in self._connections:
            return
        
        connection = self._connections[connection_id]
        connection.rooms.discard(room)
        
        if room in self._room_connections:
            self._room_connections[room].discard(connection_id)
            if not self._room_connections[room]:
                del self._room_connections[room]
        
        logger.debug(f"Connection {connection_id} unsubscribed from room {room}")
    
    async def broadcast_to_room(self, room: str, message: Dict[str, Any]):
        """
        Broadcast a message to all connections in a room
        
        Args:
            room: Room name
            message: Message to broadcast
        """
        if room not in self._room_connections:
            return
        
        connection_ids = list(self._room_connections[room])
        await asyncio.gather(
            *[self._send_to_connection(conn_id, message) for conn_id in connection_ids],
            return_exceptions=True
        )
        
        logger.debug(f"Broadcasted to room {room}: {len(connection_ids)} connections")
    
    async def broadcast_to_user(self, user_id: str, message: Dict[str, Any]):
        """
        Broadcast a message to all connections of a user
        
        Args:
            user_id: User ID
            message: Message to broadcast
        """
        if user_id not in self._user_connections:
            return
        
        connection_ids = list(self._user_connections[user_id])
        await asyncio.gather(
            *[self._send_to_connection(conn_id, message) for conn_id in connection_ids],
            return_exceptions=True
        )
        
        logger.debug(f"Broadcasted to user {user_id}: {len(connection_ids)} connections")
    
    async def broadcast_to_all(self, message: Dict[str, Any]):
        """
        Broadcast a message to all connected clients
        
        Args:
            message: Message to broadcast
        """
        connection_ids = list(self._connections.keys())
        await asyncio.gather(
            *[self._send_to_connection(conn_id, message) for conn_id in connection_ids],
            return_exceptions=True
        )
        
        logger.debug(f"Broadcasted to all: {len(connection_ids)} connections")
    
    async def send_rental_update(
        self,
        rental_id: str,
        rental_data: Dict[str, Any],
        location_id: Optional[str] = None,
        customer_id: Optional[str] = None,
        event_type: EventType = EventType.RENTAL_UPDATE
    ):
        """
        Send rental update to relevant subscribers
        
        Args:
            rental_id: ID of the rental
            rental_data: Rental data to send
            location_id: Location ID for room-based broadcast
            customer_id: Customer ID for user-specific broadcast
            event_type: Type of rental event
        """
        message = {
            "type": event_type,
            "rental_id": rental_id,
            "data": rental_data,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        # Broadcast to location room
        if location_id:
            await self.broadcast_to_room(f"location:{location_id}", message)
        
        # Broadcast to customer
        if customer_id:
            await self.broadcast_to_user(customer_id, message)
        
        # Broadcast to global rental room
        await self.broadcast_to_room("rentals:all", message)
    
    async def handle_message(self, connection_id: str, message: Dict[str, Any]):
        """
        Handle incoming WebSocket message
        
        Args:
            connection_id: ID of the connection
            message: Received message
        """
        if connection_id not in self._connections:
            return
        
        connection = self._connections[connection_id]
        message_type = message.get("type")
        
        self.stats["messages_received"] += 1
        
        try:
            if message_type == EventType.HEARTBEAT:
                # Update heartbeat
                connection.last_heartbeat = datetime.utcnow()
                await self._send_to_connection(connection_id, {
                    "type": EventType.HEARTBEAT,
                    "timestamp": datetime.utcnow().isoformat()
                })
                
            elif message_type == EventType.SUBSCRIBE:
                # Subscribe to room
                room = message.get("room")
                if room:
                    await self.subscribe_to_room(connection_id, room)
                    await self._send_to_connection(connection_id, {
                        "type": "subscribed",
                        "room": room
                    })
                
                # Update filters
                filters = message.get("filters")
                if filters:
                    connection.filters = filters
                    
            elif message_type == EventType.UNSUBSCRIBE:
                # Unsubscribe from room
                room = message.get("room")
                if room:
                    await self.unsubscribe_from_room(connection_id, room)
                    await self._send_to_connection(connection_id, {
                        "type": "unsubscribed",
                        "room": room
                    })
                    
        except Exception as e:
            logger.error(f"Error handling message from {connection_id}: {e}")
            self.stats["errors"] += 1
            await self._send_to_connection(connection_id, {
                "type": EventType.ERROR,
                "message": str(e)
            })
    
    async def _send_to_connection(self, connection_id: str, message: Dict[str, Any]):
        """
        Send a message to a specific connection
        
        Args:
            connection_id: ID of the connection
            message: Message to send
        """
        if connection_id not in self._connections:
            return
        
        connection = self._connections[connection_id]
        
        try:
            await connection.websocket.send_json(message)
            self.stats["messages_sent"] += 1
        except Exception as e:
            logger.error(f"Error sending to {connection_id}: {e}")
            self.stats["errors"] += 1
            # Remove failed connection
            await self.disconnect(connection_id)
    
    async def _heartbeat_monitor(self):
        """Monitor connections and send heartbeats"""
        while True:
            try:
                await asyncio.sleep(self.heartbeat_interval)
                
                now = datetime.utcnow()
                disconnected = []
                
                for connection_id, connection in self._connections.items():
                    # Check for stale connections
                    time_since_heartbeat = (now - connection.last_heartbeat).total_seconds()
                    if time_since_heartbeat > self.heartbeat_timeout:
                        logger.warning(f"Connection {connection_id} timed out")
                        disconnected.append(connection_id)
                    else:
                        # Send heartbeat
                        await self._send_to_connection(connection_id, {
                            "type": EventType.HEARTBEAT,
                            "timestamp": now.isoformat()
                        })
                
                # Disconnect stale connections
                for connection_id in disconnected:
                    await self.disconnect(connection_id)
                    
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in heartbeat monitor: {e}")
                await asyncio.sleep(5)
    
    def get_stats(self) -> Dict[str, Any]:
        """Get WebSocket manager statistics"""
        return {
            **self.stats,
            "active_connections": len(self._connections),
            "active_users": len(self._user_connections),
            "active_rooms": len(self._room_connections),
            "connections_by_room": {
                room: len(connections) 
                for room, connections in self._room_connections.items()
            }
        }


# Global WebSocket manager instance
websocket_manager = WebSocketManager()