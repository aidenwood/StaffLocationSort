# Staff Location Sort - Inspection Scheduler 

A comprehensive roof inspection scheduling system for Logan, QLD with both staff management and client booking interfaces.

## 🚀 Features

### Staff Dashboard
- **Inspector Calendar View** - Weekly calendar with time slots and appointments
- **Google Maps Integration** - Route visualization and optimization
- **Real-time Filtering** - Filter by inspector or region
- **Interactive Map Controls** - Day navigation and appointment highlighting
- **Drive Time Analysis** - Calculate route impact for new bookings
- **Appointment Management** - Click to view detailed appointment information

### Client Booking Interface
- **Smart Address Lookup** - Google Places API autocomplete with Logan area validation
- **Visual Availability Calendar** - See available time slots across all Logan inspectors
- **Seamless Booking Flow** - Two-step process: Address → Calendar → Booking
- **Real-time Validation** - Ensures addresses are within service area
- **Professional UI** - Clean, responsive design optimized for mobile and desktop

### Technical Features
- **Pipedrive API v2 Ready** - Full compatibility with Pipedrive Activities API
- **Google Maps Integration** - Places API, Maps API, and Directions API
- **Responsive Design** - Works seamlessly on all devices
- **Logan Area Focus** - Optimized for Logan Central, Logan, and Beenleigh regions

## 🛠 Technology Stack

- **Frontend**: React 18, Vite
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Maps**: Google Maps API (Maps, Places, Directions)
- **Date Management**: date-fns
- **API Integration**: Pipedrive Activities API v2 compatible

## 📋 Prerequisites

- Node.js 18+ 
- npm or yarn
- Google Maps API key with the following APIs enabled:
  - Maps JavaScript API
  - Places API
  - Directions API

## 🚀 Quick Start

### 1. Clone Repository
```bash
git clone https://github.com/yourusername/staff-location-sort.git
cd staff-location-sort
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Setup
Create a `.env` file in the root directory:
```env
VITE_GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
```

### 4. Development Server
```bash
npm run dev
```

Visit `http://localhost:5173` to access the application.

## 🌐 Usage

### Staff Interface
- **Default View**: `http://localhost:5173` or `http://localhost:5173#staff`
- Select inspector/region using the dropdown in the calendar header
- Click day headers to change the map view date
- Use map navigation arrows to browse different days
- Hover over appointments to see details

### Client Booking
- **Access**: `http://localhost:5173#book` or click "Client Booking" button
- Enter a Logan area address (autocomplete will suggest valid addresses)
- Select from available time slots
- Fill in contact details and submit booking

## 📁 Project Structure

```
src/
├── components/
│   ├── InspectionDashboard.jsx    # Main staff dashboard
│   ├── InspectorCalendar.jsx      # Calendar grid component
│   ├── GoogleMapsView.jsx         # Google Maps integration
│   ├── ClientBooking.jsx          # Client-facing booking interface
│   ├── InspectorView.jsx          # Individual inspector view
│   └── RoofInspectionBooking.jsx  # Booking form modal
├── data/
│   └── mockActivities.js          # Mock data (Pipedrive compatible)
├── App.jsx                        # Main app with routing
└── main.jsx                       # Entry point
```

## 🔧 Configuration

### Google Maps API Setup
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable the following APIs:
   - Maps JavaScript API
   - Places API  
   - Directions API
4. Create credentials (API Key)
5. Restrict the API key to your domains for security

### Environment Variables
- `VITE_GOOGLE_MAPS_API_KEY`: Your Google Maps API key

## 🚀 Deployment

### Netlify Deployment (Recommended)

1. **Connect Repository**: Link your GitHub repository to Netlify

2. **Build Settings**:
   - Build command: `npm run build`
   - Publish directory: `dist`

3. **Environment Variables**:
   Add in Netlify dashboard under Site Settings → Environment Variables:
   ```
   VITE_GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
   ```

4. **Deploy**: Netlify will automatically deploy on every push to main branch

### Manual Deployment
```bash
# Build for production
npm run build

# The dist/ folder contains the built app ready for deployment
```

## 🔌 Pipedrive Integration

This application is designed to integrate seamlessly with Pipedrive's Activities API v2. The mock data structure matches exactly:

### Key API Endpoints
```javascript
// Get activities for specific inspector
GET /api/v2/activities?owner_id={inspector_id}&done=false

// Create new activity (from client booking)
POST /api/v2/activities
```

### Data Structure Alignment
- ✅ `owner_id` for inspector assignment
- ✅ `due_date`, `due_time`, `duration` for scheduling
- ✅ `location` object with full address details
- ✅ `attendees` array for client information
- ✅ All required Pipedrive fields included

## 🎨 Customization

### Adding New Regions
1. Update `inspectors` array in `src/data/mockActivities.js`
2. Add region validation in `ClientBooking.jsx`
3. Update Google Maps bounds for new service areas

### Styling Changes
- Modify Tailwind classes throughout components
- Update `src/index.css` for global styles
- Colors and branding can be customized via Tailwind config

### Adding Features
- Extend mock data structure in `mockActivities.js`
- Add new components in `src/components/`
- Update routing in `App.jsx`

## 🐛 Troubleshooting

### Google Maps Not Loading
- Check API key is correct and has required APIs enabled
- Verify domain restrictions on API key
- Check browser console for specific error messages

### Address Autocomplete Not Working
- Ensure Places API is enabled
- Check API key permissions
- Verify network connectivity

### Build Issues
- Clear node_modules: `rm -rf node_modules && npm install`
- Check Node.js version (requires 18+)
- Verify all environment variables are set

## 📄 License

This project is licensed under the MIT License.

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/new-feature`
3. Commit changes: `git commit -am 'Add new feature'`
4. Push to branch: `git push origin feature/new-feature`
5. Submit pull request

## 📞 Support

For questions or support, please open an issue on GitHub or contact the development team.

---

**Built with ❤️ for efficient roof inspection scheduling in Logan, QLD**