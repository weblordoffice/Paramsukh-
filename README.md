# ParamSukh - Wellness & Spiritual Growth Platform

A comprehensive mobile and web platform for spiritual courses, community engagement, events, and guided meditation.

## 📁 Project Structure
send to the weblord office

```
paramsukh/
├── backend/          # Node.js/Express API server
├── admin/            # Next.js admin dashboard
├── mobile/           # React Native (Expo) mobile app
├── DEPLOYMENT.md     # Detailed deployment guide
└── DEPLOYMENT_QUICK_REFERENCE.md  # Quick deployment checklist
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- MongoDB (local or Atlas)
- Expo CLI
- Git

### Setup Development Environment

#### 1. Backend
```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your MongoDB URI and other credentials
npm run dev
```

Backend runs on: `http://localhost:3000`

#### 2. Admin Panel
```bash
cd admin
npm install
echo "NEXT_PUBLIC_API_URL=http://localhost:3000" > .env.local
npm run dev
```

Admin panel runs on: `http://localhost:3001`

#### 3. Mobile App
```bash
cd mobile
npm install
# Update mobile/config/api.ts with your local IP
npx expo start
```

Scan QR code with Expo Go app

## 📦 Features

### Mobile App
- 📱 Phone OTP Authentication
- 📚 Browse & Enroll in Courses
- 🎯 Assessment System
- 👥 Community Groups & Posts
- 📅 Events & Live Sessions
- 🎧 Podcasts
- 💳 Membership Plans
- 🔔 Push Notifications
- 📸 Media Upload (Images/Videos)

### Admin Dashboard
- 👥 User Management
- 📚 Course Management (Videos, PDFs, Live Sessions)
- 📅 Event Management
- 👨‍💼 Membership Management
- 📊 Analytics Dashboard
- 💬 Community Moderation
- 📝 Assessment Review

### Backend API
- 🔐 JWT Authentication with Refresh Tokens
- 📱 OTP via Fast2SMS
- 🔥 Firebase Push Notifications
- ☁️ Cloudinary Media Storage
- 📊 MongoDB Database
- 🚀 RESTful API Architecture

## 🛠️ Tech Stack

### Backend
- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: MongoDB + Mongoose
- **Authentication**: JWT, Firebase Auth
- **File Storage**: Cloudinary
- **SMS**: Fast2SMS

### Admin Panel
- **Framework**: Next.js 14
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **State Management**: React Hooks

### Mobile App
- **Framework**: React Native (Expo)
- **Language**: TypeScript
- **Navigation**: Expo Router
- **State Management**: Zustand
- **Storage**: AsyncStorage + SecureStore
- **Styling**: NativeWind (Tailwind)

## 📝 Environment Variables

### Backend (.env)
```env
NODE_ENV=development
PORT=3000
MONGO_URI=mongodb://localhost:27017/paramsukh
JWT_SECRET=your_jwt_secret
JWT_REFRESH_SECRET=your_refresh_secret
FAST2SMS_API_KEY=your_fast2sms_key
CLOUDINARY_CLOUD_NAME=your_cloudinary_name
CLOUDINARY_API_KEY=your_cloudinary_key
CLOUDINARY_API_SECRET=your_cloudinary_secret
FIREBASE_ADMIN_SDK_PATH=./serviceAccountKey.json
```

### Admin Panel (.env.local)
```env
NEXT_PUBLIC_API_URL=http://localhost:3000
```

### Mobile App (mobile/config/api.ts)
```typescript
// Update FALLBACK_IPS with your local network IP
const FALLBACK_IPS = [
  '192.168.0.103',  // Your IP here
];
```

## 🚢 Deployment

See detailed guides:
- **[DEPLOYMENT.md](DEPLOYMENT.md)** - Complete deployment instructions
- **[DEPLOYMENT_QUICK_REFERENCE.md](DEPLOYMENT_QUICK_REFERENCE.md)** - Quick checklist

### Quick Deploy:
1. **Backend** → Render.com / Railway.app
2. **Admin** → Vercel.com / Netlify
3. **Mobile** → `eas build --platform android`

## 📱 Mobile App Configuration

After deploying backend, update:

**mobile/app.json**:
```json
{
  "expo": {
    "extra": {
      "apiUrl": "https://api.paramsukh.com/api"
    }
  }
}
```

## 🔧 Available Scripts

### Backend
```bash
npm start       # Start production server
npm run dev     # Start development server
npm test        # Run tests
```

### Admin
```bash
npm run dev     # Start development server
npm run build   # Build for production
npm start       # Start production server
```

### Mobile
```bash
npx expo start              # Start Expo dev server
npx expo start --clear      # Clear cache and start
eas build --platform android  # Build Android APK
eas build --platform ios      # Build iOS IPA
```

## 📚 API Documentation

Base URL: `http://localhost:3000/api`

### Authentication
- `POST /auth/send-otp` - Send OTP to phone
- `POST /auth/verify-otp` - Verify OTP and login
- `POST /auth/logout` - Logout user
- `GET /auth/me` - Get current user

### Courses
- `GET /courses` - Get all courses
- `GET /courses/:id` - Get course by ID
- `POST /courses` - Create course (admin)
- `PUT /courses/:id` - Update course (admin)
- `DELETE /courses/:id` - Delete course (admin)

### Community
- `GET /community/my-groups` - Get user's groups
- `GET /community/groups/:id/posts` - Get group posts
- `POST /community/groups/:id/posts` - Create post
- `POST /community/posts/:id/like` - Like post

[See full API documentation in backend/README.md]

## 🧪 Testing

### Backend
```bash
cd backend
npm test
npm run test:coverage
```

### Mobile
```bash
cd mobile
# Test on physical device with Expo Go app
npx expo start
```

## 📊 Database Schema

### Main Collections
- **users** - User accounts and profiles
- **courses** - Course content and metadata
- **enrollments** - User course enrollments and progress
- **events** - Live events and sessions
- **groups** - Community groups
- **posts** - Community posts
- **assessments** - User assessments and answers
- **memberships** - Subscription plans and active subscriptions

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📄 License

This project is private and proprietary.

## 🆘 Support

For issues and questions:
1. Check [DEPLOYMENT.md](DEPLOYMENT.md) for deployment issues
2. Check logs: `pm2 logs` or deployment platform logs
3. Open an issue in the repository

---

**Built with ❤️ for spiritual wellness and growth**
