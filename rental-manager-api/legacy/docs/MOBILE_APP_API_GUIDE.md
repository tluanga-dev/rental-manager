# Mobile App API Integration Guide

## Overview

The Rental Manager Backend API is configured to accept requests from mobile applications. Since mobile apps don't have traditional web origins, they are handled differently from web-based clients.

## How CORS Works for Mobile Apps

### Key Differences from Web Apps

1. **No Origin Header**: Mobile apps don't send an `Origin` header in their requests
2. **Direct API Access**: Mobile apps make direct HTTP/HTTPS requests to the API
3. **Wildcard CORS**: The backend uses `Access-Control-Allow-Origin: *` in production to allow any client

## API Configuration for Mobile Apps

### Production Environment (Railway)

The production API automatically allows requests from any source, including:
- Native iOS apps (Swift/Objective-C)
- Native Android apps (Kotlin/Java)
- React Native apps
- Flutter apps
- Ionic/Capacitor apps
- Any other mobile framework

### API Base URL

```
https://your-railway-backend-url.railway.app/api
```

## Authentication for Mobile Apps

Mobile apps should use the standard JWT authentication flow:

### 1. Login

```http
POST /api/auth/login
Content-Type: application/json

{
  "username": "user@example.com",
  "password": "password123"
}
```

Response:
```json
{
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "token_type": "bearer"
}
```

### 2. Using the Access Token

Include the token in all subsequent requests:

```http
GET /api/items
Authorization: Bearer eyJ...
```

### 3. Refreshing Tokens

When the access token expires:

```http
POST /api/auth/refresh
Content-Type: application/json

{
  "refresh_token": "eyJ..."
}
```

## Best Practices for Mobile Apps

### 1. Secure Token Storage

- **iOS**: Use Keychain Services
- **Android**: Use Android Keystore or Encrypted SharedPreferences
- **React Native**: Use libraries like `react-native-keychain`
- **Flutter**: Use `flutter_secure_storage`

### 2. API Request Examples

#### JavaScript/React Native
```javascript
const API_BASE = 'https://your-railway-backend-url.railway.app/api';

async function fetchItems(accessToken) {
  const response = await fetch(`${API_BASE}/items`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  
  return await response.json();
}
```

#### Swift (iOS)
```swift
let url = URL(string: "https://your-railway-backend-url.railway.app/api/items")!
var request = URLRequest(url: url)
request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
request.setValue("application/json", forHTTPHeaderField: "Content-Type")

URLSession.shared.dataTask(with: request) { data, response, error in
    // Handle response
}.resume()
```

#### Kotlin (Android)
```kotlin
val client = OkHttpClient()
val request = Request.Builder()
    .url("https://your-railway-backend-url.railway.app/api/items")
    .header("Authorization", "Bearer $accessToken")
    .header("Content-Type", "application/json")
    .build()

client.newCall(request).execute().use { response ->
    // Handle response
}
```

### 3. Error Handling

Always handle these common scenarios:
- Network errors (no internet connection)
- Token expiration (401 responses)
- Server errors (500+ status codes)
- Rate limiting (429 responses)

### 4. API Rate Limiting

The API implements rate limiting. Mobile apps should:
- Implement exponential backoff for retries
- Cache responses when appropriate
- Batch requests when possible

## Security Considerations

### 1. API Key Management

While the API uses wildcard CORS in production, consider implementing:
- API keys for mobile app identification
- Request signing for additional security
- Certificate pinning for critical applications

### 2. Data Encryption

- Always use HTTPS (never HTTP)
- Consider additional encryption for sensitive data
- Implement certificate pinning for banking-level security

### 3. User Authentication

- Implement biometric authentication where available
- Use secure storage for tokens
- Implement automatic token refresh
- Add logout functionality that clears tokens

## Testing Your Mobile App

### Development Environment

For local development, the API also accepts requests from mobile apps:

1. Run the backend locally:
```bash
cd rental-manager-backend
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

2. Configure your mobile app to use your local IP:
```
http://YOUR_LOCAL_IP:8000/api
```

Note: Use your machine's local IP (e.g., 192.168.1.100), not localhost

### Production Testing

Test against the Railway deployment:
```
https://your-railway-backend-url.railway.app/api
```

## Common Issues and Solutions

### Issue 1: Connection Refused
**Solution**: Ensure the backend is running and accessible. Check firewall settings.

### Issue 2: 401 Unauthorized
**Solution**: Verify the token is valid and properly formatted in the Authorization header.

### Issue 3: Network Timeouts
**Solution**: Implement proper timeout handling and retry logic with exponential backoff.

### Issue 4: CORS Errors (Development Only)
**Solution**: In development, the backend automatically handles CORS. In production, wildcard CORS is enabled.

## API Documentation

Full API documentation is available at:
- Swagger UI: `https://your-railway-backend-url.railway.app/docs`
- ReDoc: `https://your-railway-backend-url.railway.app/redoc`

## Support

For API issues or questions:
1. Check the API documentation
2. Review server logs in Railway dashboard
3. Contact the development team

## Version Compatibility

- API Version: 1.0
- Minimum supported mobile OS versions:
  - iOS: 12.0+
  - Android: API Level 21 (5.0 Lollipop)+