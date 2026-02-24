// Mock data matching Pipedrive Activities API format
// Logan, QLD area coordinates and addresses

export const inspectors = [
  {
    id: 1,
    name: "Ross Mitchell",
    email: "ross@inspections.com.au",
    active_flag: true,
    phone: "+61 7 3123 4567",
    region: "Logan Central"
  },
  {
    id: 2,
    name: "Ben Thompson",
    email: "ben@inspections.com.au", 
    active_flag: true,
    phone: "+61 7 3123 4568",
    region: "Logan"
  },
  {
    id: 3,
    name: "Jayden Wilson",
    email: "jayden@inspections.com.au",
    active_flag: true,
    phone: "+61 7 3123 4569",
    region: "Beenleigh"
  }
];

export const activityTypes = [
  {
    id: 1,
    name: "Roof Inspection - Hail Damage",
    key_string: "roof_inspection",
    icon_key: "home",
    color: "blue",
    order_nr: 1,
    active_flag: true
  }
];

// Real Logan QLD area locations with accurate coordinates
export const loganLocations = [
  { address: "Woodridge Plaza, 123 Ewing Road, Woodridge QLD 4114", lat: -27.6285, lng: 153.1089 },
  { address: "Logan Central Plaza, 1 Wembley Road, Logan Central QLD 4114", lat: -27.6378, lng: 153.1094 },
  { address: "Browns Plains Shopping Centre, Browns Plains Road, Browns Plains QLD 4118", lat: -27.6567, lng: 153.0789 },
  { address: "Springwood Road Shopping Village, 3972 Pacific Highway, Springwood QLD 4127", lat: -27.6334, lng: 153.1289 },
  { address: "Beenleigh Marketplace, 90-106 George Street, Beenleigh QLD 4207", lat: -27.7108, lng: 153.2034 },
  { address: "Loganholme Hyperdome, 3334 Pacific Highway, Loganholme QLD 4129", lat: -27.6789, lng: 153.2012 },
  { address: "Marsden Park Shopping Centre, 3828 Logan Road, Marsden QLD 4132", lat: -27.6645, lng: 153.1023 },
  { address: "Park Ridge Shopping Village, 2605 Logan Road, Eight Mile Plains QLD 4113", lat: -27.6234, lng: 153.0956 },
  { address: "Eagleby Shopping Centre, 25-45 Bethania Road, Eagleby QLD 4207", lat: -27.6923, lng: 153.2167 },
  { address: "Waterford West Shopping Centre, 2269 Logan Road, Waterford West QLD 4133", lat: -27.6712, lng: 153.1234 },
  { address: "Kingston Butter Factory, 270 Kingston Road, Slacks Creek QLD 4127", lat: -27.6445, lng: 153.1156 },
  { address: "Heritage Park Shopping Centre, Heritage Park Drive, Heritage Park QLD 4118", lat: -27.6678, lng: 153.0623 },
  { address: "Chambers Flat Road Business Centre, 1234 Chambers Flat Road, Park Ridge QLD 4125", lat: -27.7234, lng: 153.0456 },
  { address: "Logan Road Medical Centre, 2850 Logan Road, Underwood QLD 4119", lat: -27.6156, lng: 153.1234 },
  { address: "Algester Village Shopping Centre, Algester Road, Algester QLD 4115", lat: -27.6589, lng: 153.0445 }
];

// Specific real addresses for Ross Mitchell's appointments today with corrected coordinates
export const rossTodayAddresses = [
  { address: "22 Arafura Avenue, Loganholme QLD 4129, Australia", lat: -27.6773, lng: 153.2087 },
  { address: "14 Girralong Street, Eagleby QLD 4207, Australia", lat: -27.6948, lng: 153.2144 },
  { address: "76 Kent St, Beenleigh QLD 4207, Australia", lat: -27.7108, lng: 153.2034 },
  { address: "40 Sambit Street, Tanah Merah QLD 4128, Australia", lat: -27.6029, lng: 153.1615 }
];

// Generate activities for today and next 7 days
export const generateMockActivities = () => {
  const activities = [];
  const today = new Date();
  
  
  // Generate activities for each inspector over the next 7 days
  inspectors.forEach((inspector, inspectorIndex) => {
    for (let day = 0; day < 7; day++) {
      const activityDate = new Date(today);
      activityDate.setDate(today.getDate() + day);
      
      // Special handling for Ross Mitchell's appointments today with real addresses
      const isRossToday = inspector.id === 1 && day === 0; // Ross Mitchell (ID: 1) and today (day 0)
      
      if (isRossToday) {
        // Use specific real addresses for Ross today
        rossTodayAddresses.forEach((realLocation, index) => {
          const hour = 9 + (index * 2); // Spread appointments: 9am, 11am, 1pm, 3pm
          const dueDateTime = new Date(activityDate);
          dueDateTime.setHours(hour, 0, 0, 0);
          
          const activity = {
            id: activities.length + 1,
            company_id: 12345,
            owner_id: inspector.id,
            creator_user_id: inspector.id,
            is_deleted: false,
            done: false,
            type: "roof_inspection",
            conference_meeting_client: null,
            conference_meeting_url: null,
            conference_meeting_id: null,
            due_date: dueDateTime.toISOString().split('T')[0],
            due_time: dueDateTime.toTimeString().split(' ')[0].substring(0, 8),
            duration: "01:00:00",
            busy: true,
            add_time: new Date().toISOString(),
            update_time: new Date().toISOString(),
            marked_as_done_time: null,
            subject: `Roof Inspection - ${realLocation.address.split(',')[0]}`,
            public_description: `Professional roof inspection for property at ${realLocation.address}`,
            note: "Client requested specific time slot",
            priority: 2,
            location: {
              value: realLocation.address,
              country: "Australia",
              admin_area_level_1: "Queensland",
              admin_area_level_2: null,
              locality: realLocation.address.includes("Loganholme") ? "Loganholme" : 
                       realLocation.address.includes("Eagleby") ? "Eagleby" :
                       realLocation.address.includes("Beenleigh") ? "Beenleigh" : "Tanah Merah",
              sublocality: null,
              route: realLocation.address.split(' ').slice(1, -3).join(' '),
              street_number: realLocation.address.split(' ')[0],
              subpremise: null,
              postal_code: realLocation.address.match(/QLD (\d{4})/)?.[1] || "4114"
            },
            location_lat: realLocation.lat,
            location_lng: realLocation.lng,
            org_id: Math.floor(Math.random() * 1000) + 1,
            person_id: Math.floor(Math.random() * 1000) + 1,
            deal_id: Math.floor(Math.random() * 1000) + 1,
            lead_id: `lead-${Math.random().toString(36).substr(2, 9)}`,
            project_id: null,
            attendees: [
              {
                person_id: Math.floor(Math.random() * 1000) + 1,
                primary: true,
                email: `client${Math.floor(Math.random() * 1000)}@example.com`,
                name: `${["John", "Sarah", "Mike", "Emma", "David"][Math.floor(Math.random() * 5)]} ${["Smith", "Johnson", "Brown", "Wilson", "Taylor"][Math.floor(Math.random() * 5)]}`,
                status: "accepted",
                is_organizer: false
              }
            ],
            roof_type: ["Metal Roof", "Decramastic roof tiles", "Asbestos roof", "Mixed"][Math.floor(Math.random() * 4)],
            property_type: ["House", "Unit", "Townhouse"][Math.floor(Math.random() * 3)],
            inspection_fee: 350,
            client_contact: `+61 4${Math.floor(Math.random() * 90000000) + 10000000}`,
            special_instructions: "Real client address - handle with care",
            source_timezone: "Australia/Brisbane"
          };
          
          activities.push(activity);
        });
      } else {
        // Generate 3-5 activities per inspector per day (avoiding lunch hour) - normal generation
        const activitiesPerDay = 3 + Math.floor(Math.random() * 3);
        
        for (let i = 0; i < activitiesPerDay; i++) {
          const location = loganLocations[Math.floor(Math.random() * loganLocations.length)];
          const activityType = activityTypes[0]; // Only roof inspections now
          
          // Generate time slots (9 AM to 4 PM, avoiding lunch 12-1 PM)
          let hour, minute;
          do {
            hour = 9 + Math.floor(Math.random() * 7);
            minute = Math.random() > 0.5 ? 0 : 30;
          } while (hour === 12); // Avoid lunch hour
          
          const dueDateTime = new Date(activityDate);
          dueDateTime.setHours(hour, minute, 0, 0);
          
          const activity = {
            id: activities.length + 1,
            company_id: 12345,
            owner_id: inspector.id, // Pipedrive v2 uses owner_id
            creator_user_id: inspector.id,
          is_deleted: false,
          done: day < 0, // Past activities are done
          type: activityType.key_string,
          conference_meeting_client: null,
          conference_meeting_url: null,
          conference_meeting_id: null,
          due_date: dueDateTime.toISOString().split('T')[0],
          due_time: dueDateTime.toTimeString().split(' ')[0].substring(0, 8), // HH:MM:SS format
          duration: "01:00:00", // Default 1 hour for roof inspections
          busy: true, // Pipedrive v2 uses 'busy' not 'busy_flag'
          add_time: new Date().toISOString(),
          update_time: new Date().toISOString(),
          marked_as_done_time: day < 0 ? new Date(dueDateTime.getTime() + 2 * 60 * 60 * 1000).toISOString() : null,
          subject: `${activityType.name} - ${location.address.split(',')[0]}`,
          public_description: `Professional ${activityType.name.toLowerCase()} for property at ${location.address}`,
          note: Math.random() > 0.7 ? "Client requested early morning appointment" : null,
          priority: Math.floor(Math.random() * 3) + 1, // 1-3 priority level
          // Location object structure matching Pipedrive API
          location: {
            value: location.address,
            country: "Australia", 
            admin_area_level_1: "Queensland",
            admin_area_level_2: null,
            locality: location.address.split(' QLD ')[0].split(', ').pop(),
            sublocality: null,
            route: location.address.split(' ').slice(1, -3).join(' '),
            street_number: location.address.split(' ')[0],
            subpremise: null,
            postal_code: location.address.match(/QLD (\d{4})/)?.[1] || "4114"
          },
          // Add coordinates for map visualization
          location_lat: location.lat,
          location_lng: location.lng,
          org_id: Math.floor(Math.random() * 1000) + 1,
          person_id: Math.floor(Math.random() * 1000) + 1,
          deal_id: Math.floor(Math.random() * 1000) + 1,
          lead_id: `lead-${Math.random().toString(36).substr(2, 9)}`,
          project_id: null,
          // Attendees array matching Pipedrive structure
          attendees: [
            {
              person_id: Math.floor(Math.random() * 1000) + 1,
              primary: true,
              email: `client${Math.floor(Math.random() * 1000)}@example.com`,
              name: `${["John", "Sarah", "Mike", "Emma", "David"][Math.floor(Math.random() * 5)]} ${["Smith", "Johnson", "Brown", "Wilson", "Taylor"][Math.floor(Math.random() * 5)]}`,
              status: "accepted",
              is_organizer: false
            }
          ],
          // Custom fields for roof inspection details  
          roof_type: ["Metal Roof", "Decramastic roof tiles", "Asbestos roof", "Mixed"][Math.floor(Math.random() * 4)],
          property_type: ["House", "Unit", "Townhouse"][Math.floor(Math.random() * 3)],
          inspection_fee: 350, // Standard roof inspection fee
          client_contact: `+61 4${Math.floor(Math.random() * 90000000) + 10000000}`,
          special_instructions: Math.random() > 0.7 ? "Focus on north-facing section, visible hail damage" : null,
          // Additional Pipedrive fields
          source_timezone: "Australia/Brisbane"
        };
        
          activities.push(activity);
        }
      }
    }
  });
  
  // Sort activities by date and time
  activities.sort((a, b) => {
    const dateA = new Date(`${a.due_date}T${a.due_time}`);
    const dateB = new Date(`${b.due_date}T${b.due_time}`);
    return dateA - dateB;
  });
  
  return activities;
};

export const mockActivities = generateMockActivities();


// Helper functions for the UI
export const getActivitiesByInspector = (inspectorId) => {
  return mockActivities.filter(activity => activity.owner_id === inspectorId);
};

export const getActivitiesByDate = (date) => {
  const dateString = date.toISOString().split('T')[0];
  return mockActivities.filter(activity => activity.due_date === dateString);
};

export const getActivitiesByInspectorAndDate = (inspectorId, date) => {
  const dateString = date.toISOString().split('T')[0];
  const filtered = mockActivities.filter(
    activity => activity.owner_id === inspectorId && activity.due_date === dateString
  );
  
  
  return filtered;
};

export const getInspectorById = (id) => {
  return inspectors.find(inspector => inspector.id === id);
};

export const getActivityTypeByKey = (keyString) => {
  return activityTypes.find(type => type.key_string === keyString);
};