# Rental Manager - Full Stack Application

A comprehensive rental property management system with inventory tracking, built with FastAPI (backend) and Next.js (frontend).

## 🚀 Quick Start

### Prerequisites
- Docker and Docker Compose
- Node.js 18+ (for local development)
- Python 3.11+ (for local backend development)

### One Command Start
```bash
docker-compose up -d
```

That's it! The application will be available at:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000/api/v1
- **API Documentation**: http://localhost:8000/docs
- **pgAdmin**: http://localhost:5050 (admin@rentalmanager.com / admin)

## 🎯 Key Features

### Development Mode (Default)
**Authentication is bypassed by default in development!** You can start working immediately without logging in. This makes development faster and more enjoyable.

- ✅ No login required
- ✅ Full admin permissions
- ✅ All RBAC checks bypassed
- ✅ Visual indicators when bypass is active
- ✅ Automatic safety in production

[Learn more about Development Mode](./DEVELOPMENT_MODE_DEFAULT.md)

### Core Features
- **Multi-tenant Property Management**: Manage multiple properties and units
- **Inventory Tracking**: Complete inventory management with SKU generation
- **Customer Management**: Track customers, suppliers, and contacts
- **Transaction Processing**: Handle rentals, purchases, and sales
- **Real-time Analytics**: Dashboard with business insights
- **Role-Based Access Control**: Granular permissions system (disabled in dev mode by default)

## 🏗️ Architecture

### Technology Stack
- **Backend**: FastAPI 0.116+, PostgreSQL 17, Redis 8, SQLAlchemy 2.0
- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS
- **Infrastructure**: Docker, Docker Compose, Nginx

### Project Structure
```
rental-manager/
├── rental-manager-api/          # FastAPI backend
│   ├── app/                     # Application code
│   ├── alembic/                 # Database migrations
│   └── tests/                   # Test suite
├── rental-manager-frontend/     # Next.js frontend
│   ├── src/                     # Source code
│   └── tests/                   # Frontend tests
├── docker-compose.yml           # Development environment
└── docker-compose.prod.yml      # Production environment
```

## 🛠️ Development

### Local Development Setup

#### Backend Only
```bash
cd rental-manager-api
cp .env.example .env  # Already configured for dev mode
make install
make dev
```

#### Frontend Only
```bash
cd rental-manager-frontend
cp .env.example .env.development  # Already configured for dev mode
npm install
npm run dev
```

### Development Commands

#### Backend
```bash
make dev        # Start development server
make test       # Run tests
make migrate    # Apply database migrations
make seed       # Seed sample data
make format     # Format code
```

#### Frontend
```bash
npm run dev     # Start development server
npm test        # Run tests
npm run build   # Build for production
npm run lint    # Lint code
```

## 🔒 Authentication & Security

### Development Mode (Default)
By default, authentication is **bypassed in development** for a better developer experience:
- No login screens
- Automatic admin access
- All permissions granted

To **enable authentication in development**:
```bash
# Backend: Set in .env
DISABLE_AUTH_IN_DEV=false

# Frontend: Set in .env.development
NEXT_PUBLIC_DISABLE_AUTH=false
```

### Production Mode
Authentication is **always required in production**:
- JWT-based authentication
- Role-based access control
- Secure password hashing
- Token refresh mechanism

## 🚢 Deployment

### Production Deployment
```bash
# Using production compose file
docker-compose -f docker-compose.prod.yml up -d

# Or set production environment
export ENVIRONMENT=production
docker-compose up -d
```

### Environment Variables
Key environment variables are documented in:
- Backend: `rental-manager-api/.env.example`
- Frontend: `rental-manager-frontend/.env.example`

Production overrides:
- Backend: `rental-manager-api/.env.production`
- Frontend: `rental-manager-frontend/.env.production`

## 📚 Documentation

- [Development Mode Guide](./DEVELOPMENT_MODE_DEFAULT.md)
- [API Documentation](http://localhost:8000/docs) (when running)
- [Backend README](./rental-manager-api/README.md)
- [Frontend README](./rental-manager-frontend/README.md)
- [Testing Guide](./rental-manager-api/README_TESTING.md)

## 🧪 Testing

### Run All Tests
```bash
# Backend tests
cd rental-manager-api && make test

# Frontend tests
cd rental-manager-frontend && npm test
```

### Test Coverage
- Backend: 80% minimum coverage required
- Frontend: Component and integration tests

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is proprietary software. All rights reserved.

## 🆘 Support

For issues, questions, or suggestions:
1. Check the documentation
2. Search existing issues
3. Create a new issue with detailed information

## ⚡ Quick Tips

- **Skip login in development**: Already enabled by default!
- **View API docs**: http://localhost:8000/docs
- **Database admin**: http://localhost:5050 (pgAdmin)
- **Reset database**: `cd rental-manager-api && make db-reset`
- **View logs**: `docker-compose logs -f [service-name]`

---

Built with ❤️ for efficient property management